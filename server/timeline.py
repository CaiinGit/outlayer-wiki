"""Editable world chronology, including eras and years before year zero."""
import uuid
from flask import abort, jsonify, request
from .browse import fold


def migrate_timeline(db):
    db.execute("""CREATE TABLE IF NOT EXISTS timeline (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('era','event')),
        start_year INTEGER, end_year INTEGER, date_label TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL, visible INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1, source_key TEXT UNIQUE,
        search_text TEXT NOT NULL)""")
    db.execute('CREATE INDEX IF NOT EXISTS timeline_order ON timeline(visible,position,id)')


def register_timeline(app,db,private,payload):
    def serialize(row,admin=False,full=False):
        result={k:row[k] for k in ('id','title','kind','start_year','end_year','date_label','position')}
        result['description']=row['description'] if full else row['description'][:240]
        if admin:
            result.update(visible=bool(row['visible']),revision=row['revision'],imported=bool(row['source_key']))
        return result

    def get_row(node_id,admin=False):
        row=db().execute('SELECT * FROM timeline WHERE id=?'+('' if admin else ' AND visible=1'),(node_id,)).fetchone()
        if not row:
            abort(404,description='Cet événement n’est plus disponible.')
        return row

    def validate(data):
        if not isinstance(data,dict):
            abort(400,description='Événement invalide.')
        result={}
        for key,limit in [('title',160),('description',30000),('date_label',100)]:
            value=data.get(key,'')
            if not isinstance(value,str) or len(value)>limit or (key=='title' and not value.strip()):
                abort(400,description='Titre obligatoire (160 caractères), récit limité à 30 000 caractères.')
            result[key]=value.strip()
        for key in ('start_year','end_year'):
            value=data.get(key)
            if value is not None and (type(value) is not int or not -999999999<=value<=999999999):
                abort(400,description='Les années doivent être des nombres entiers, ou rester vides.')
            result[key]=value
        if result['end_year'] is not None and (result['start_year'] is None or result['end_year']<result['start_year']):
            abort(400,description='La fin doit être postérieure ou égale au début de la période.')
        if data.get('kind','event') not in ('era','event') or type(data.get('visible',False)) is not bool:
            abort(400,description='Type ou visibilité invalide.')
        position=data.get('position',1)
        if type(position) is not int or not 1<=position<=999999:
            abort(400,description='L’ordre doit être compris entre 1 et 999 999.')
        result.update(kind=data.get('kind','event'),visible=int(data.get('visible',False)),position=position)
        result['search_text']=fold(result['title']+' '+result['description']+' '+result['date_label'])
        return result

    def listing(admin=False):
        try:
            number=max(1,int(request.args.get('page','1')))
        except ValueError:
            abort(400)
        query=request.args.get('q','').strip()
        kind=request.args.get('kind','all')
        if len(query)>200 or kind not in ('all','era','event'):
            abort(400,description='Filtres invalides.')
        where=['1=1' if admin else 'visible=1'];params=[]
        if kind!='all':where.append('kind=?');params.append(kind)
        if query:where.append('instr(search_text,?)>0');params.append(fold(query))
        where=' AND '.join(where)
        db().execute('BEGIN')
        total=db().execute('SELECT count(*) FROM timeline WHERE '+where,params).fetchone()[0]
        pages=max(1,(total+19)//20);number=min(number,pages)
        rows=db().execute('SELECT * FROM timeline WHERE '+where+' ORDER BY position,id LIMIT 20 OFFSET ?',params+[(number-1)*20]).fetchall()
        result=dict(items=[serialize(r,admin) for r in rows],total=total,page=number,pages=pages)
        if admin:result['nextPosition']=db().execute('SELECT coalesce(max(position),0)+1 FROM timeline').fetchone()[0]
        return jsonify(result)

    @app.get('/api/timeline')
    def timeline_list():return listing()

    @app.get('/api/timeline/<node_id>')
    def timeline_detail(node_id):return jsonify(serialize(get_row(node_id),full=True))

    @app.get('/api/admin/timeline')
    @private
    def timeline_admin_list():return listing(True)

    @app.get('/api/admin/timeline/<node_id>')
    @private
    def timeline_admin_detail(node_id):return jsonify(serialize(get_row(node_id,True),True,True))

    def insert(values,source_key=None):
        node_id=uuid.uuid4().hex
        columns=list(values)
        db().execute('INSERT INTO timeline (id,source_key,'+','.join(columns)+') VALUES ('+','.join(['?']*(len(columns)+2))+')',[node_id,source_key]+list(values.values()))
        return node_id

    @app.post('/api/admin/timeline')
    @private
    def timeline_create():
        values=validate(payload());node_id=insert(values);db().commit()
        return jsonify(serialize(get_row(node_id,True),True,True)),201

    @app.put('/api/admin/timeline/<node_id>')
    @private
    def timeline_update(node_id):
        data=payload();values=validate(data);db().execute('BEGIN IMMEDIATE');row=get_row(node_id,True)
        if data.get('revision')!=row['revision']:abort(409,description='Cet événement a changé. Rechargez-le avant de modifier.')
        db().execute('UPDATE timeline SET '+','.join(k+'=?' for k in values)+',revision=revision+1 WHERE id=?',list(values.values())+[node_id]);db().commit()
        return jsonify(serialize(get_row(node_id,True),True,True))

    @app.delete('/api/admin/timeline/<node_id>')
    @private
    def timeline_delete(node_id):
        data=payload();db().execute('BEGIN IMMEDIATE');row=get_row(node_id,True)
        if data.get('revision')!=row['revision']:abort(409,description='Cet événement a changé. Rechargez-le.')
        if data.get('confirmTitle')!=row['title']:abort(400,description='Retapez le titre pour confirmer la suppression.')
        db().execute('DELETE FROM timeline WHERE id=?',(node_id,));db().commit();return jsonify(ok=True)

    @app.post('/api/admin/timeline/import')
    @private
    def timeline_import():
        data=payload();items=data.get('events')
        if data.get('version')!=1 or not isinstance(items,list) or not 1<=len(items)<=200:
            abort(400,description='Import invalide : fichier de version 1, contenant de 1 à 200 événements.')
        prepared=[];keys=set()
        for item in items:
            if not isinstance(item,dict):abort(400,description='Événement invalide.')
            key=item.get('source_key')
            if not isinstance(key,str) or not 1<=len(key)<=200 or key in keys:abort(400,description='Référence source manquante ou dupliquée.')
            keys.add(key);values=validate(dict(item,visible=False));prepared.append((key,values))
        db().execute('BEGIN IMMEDIATE');added=0
        for key,values in prepared:
            if not db().execute('SELECT 1 FROM timeline WHERE source_key=?',(key,)).fetchone():insert(values,key);added+=1
        db().commit();return jsonify(added=added,skipped=len(prepared)-added)
