"""Campaign journal: fables contain arcs, which contain game sessions."""
import uuid
from datetime import date, datetime, timezone
from flask import abort, jsonify, request

KINDS = ('fable', 'arc', 'session')


def migrate_journal(db):
    db.execute("""CREATE TABLE IF NOT EXISTS journal (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('fable','arc','session')),
        parent_id TEXT REFERENCES journal(id) ON DELETE CASCADE,
        title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL, played_on TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'played' CHECK(status IN ('played','planned')),
        visible INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL)""")
    db.execute('CREATE INDEX IF NOT EXISTS journal_parent ON journal(parent_id,kind,position,id)')
    if not db.execute("SELECT 1 FROM settings WHERE key='journal-seeded-v1'").fetchone():
        stamp=datetime.now(timezone.utc).isoformat()
        for node_id,kind,parent,title,position in [('fable-i','fable',None,'I',1),('arc-1','arc','fable-i','Arc 1',1),('session-1','session','arc-1','Session 1',1),('session-2','session','arc-1','Session 2',2)]:
            db.execute('INSERT INTO journal (id,kind,parent_id,title,position,visible,updated_at) VALUES (?,?,?,?,?,1,?)',(node_id,kind,parent,title,position,stamp))
        db.execute("INSERT INTO settings VALUES ('journal-seeded-v1','1')")


def register_journal(app, db, private, payload):
    def get_row(node_id, public=False):
        row = db().execute('SELECT * FROM journal WHERE id=?', (node_id,)).fetchone()
        if not row:
            abort(404, description='Cet élément du journal n’existe plus.')
        if public:
            ancestor = row
            while ancestor:
                if not ancestor['visible']:
                    abort(404, description='Cet élément du journal n’est pas disponible.')
                ancestor = db().execute('SELECT * FROM journal WHERE id=?', (ancestor['parent_id'],)).fetchone() if ancestor['parent_id'] else None
        return row

    def item(row, full=False, admin=False):
        result = {k: row[k] for k in ('id','kind','parent_id','title','position','played_on','status')}
        result['description'] = row['description'] if full else row['description'][:180]
        if admin:
            result.update(visible=bool(row['visible']),revision=row['revision'])
        return result

    def listing(admin=False):
        kind = request.args.get('kind','fable')
        parent = request.args.get('parent') or None
        if kind not in KINDS or (kind=='fable') != (parent is None):
            abort(400, description='Niveau du journal invalide.')
        try:
            number = max(1,int(request.args.get('page','1')))
        except ValueError:
            abort(400)
        db().execute('BEGIN')
        parent_row = get_row(parent, not admin) if parent else None
        if parent_row and parent_row['kind'] != KINDS[KINDS.index(kind)-1]:
            abort(400, description='Parent incompatible.')
        where = 'kind=? AND parent_id IS ?'+('' if admin else ' AND visible=1')
        total = db().execute('SELECT count(*) FROM journal WHERE '+where,(kind,parent)).fetchone()[0]
        pages = max(1,(total+19)//20)
        number = min(number,pages)
        rows = db().execute('SELECT * FROM journal WHERE '+where+' ORDER BY position,title,id LIMIT 20 OFFSET ?', (kind,parent,(number-1)*20)).fetchall()
        result=dict(items=[item(r,admin=admin) for r in rows],parent=item(parent_row,True,admin) if parent_row else None,total=total,page=number,pages=pages)
        if admin:
            result['nextPosition']=db().execute('SELECT coalesce(max(position),0)+1 FROM journal WHERE kind=? AND parent_id IS ?',(kind,parent)).fetchone()[0]
        return jsonify(result)

    @app.get('/api/journal')
    def journal_public_list():
        return listing()

    @app.get('/api/journal/<node_id>')
    def journal_public_detail(node_id):
        return jsonify(item(get_row(node_id,True),True))

    @app.get('/api/admin/journal')
    @private
    def journal_admin_list():
        return listing(True)

    @app.get('/api/admin/journal/<node_id>')
    @private
    def journal_admin_detail(node_id):
        return jsonify(item(get_row(node_id),True,True))

    def validate(data, kind):
        result = {}
        for key,limit in [('title',160),('description',30000)]:
            value = data.get(key,'')
            if not isinstance(value,str) or len(value)>limit or (key=='title' and not value.strip()):
                abort(400, description='Renseignez un titre et une description de 30 000 caractères maximum.')
            result[key]=value.strip()
        position = data.get('position',1)
        if type(position) is not int or not 1<=position<=999999:
            abort(400, description='L’ordre doit être un nombre entier positif.')
        visible = data.get('visible',False)
        if type(visible) is not bool:
            abort(400, description='Visibilité invalide.')
        status = data.get('status','played')
        if status not in ('played','planned'):
            abort(400, description='État de session invalide.')
        played_on = data.get('played_on','') if kind=='session' else ''
        if not isinstance(played_on,str):
            abort(400, description='Date invalide.')
        if played_on:
            try:
                if date.fromisoformat(played_on).isoformat()!=played_on:
                    raise ValueError()
            except ValueError:
                abort(400, description='Date invalide.')
        result.update(position=position,visible=int(visible),status=status,played_on=played_on)
        return result

    @app.post('/api/admin/journal')
    @private
    def journal_create():
        data=payload()
        kind,parent=data.get('kind'),data.get('parent_id')
        if kind not in KINDS or (parent is not None and not isinstance(parent,str)) or (kind=='fable') != (parent is None):
            abort(400, description='Choisissez une Fable pour l’Arc, ou un Arc pour la Session.')
        values=validate(data,kind)
        db().execute('BEGIN IMMEDIATE')
        if parent and get_row(parent)['kind'] != KINDS[KINDS.index(kind)-1]:
            abort(400, description='Parent incompatible.')
        node_id=uuid.uuid4().hex
        db().execute('INSERT INTO journal (id,kind,parent_id,title,description,position,played_on,status,visible,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
                     (node_id,kind,parent,values['title'],values['description'],values['position'],values['played_on'],values['status'],values['visible'],datetime.now(timezone.utc).isoformat()))
        db().commit()
        return jsonify(item(get_row(node_id),True,True)),201

    @app.put('/api/admin/journal/<node_id>')
    @private
    def journal_update(node_id):
        data=payload()
        db().execute('BEGIN IMMEDIATE')
        row=get_row(node_id)
        if data.get('revision')!=row['revision']:
            abort(409, description='Cet élément a changé. Rechargez-le avant de modifier.')
        values=validate(data,row['kind'])
        db().execute('UPDATE journal SET title=?,description=?,position=?,played_on=?,status=?,visible=?,revision=revision+1,updated_at=? WHERE id=?',
                     (values['title'],values['description'],values['position'],values['played_on'],values['status'],values['visible'],datetime.now(timezone.utc).isoformat(),node_id))
        db().commit()
        return jsonify(item(get_row(node_id),True,True))

    @app.delete('/api/admin/journal/<node_id>')
    @private
    def journal_delete(node_id):
        data=payload()
        db().execute('BEGIN IMMEDIATE')
        row=get_row(node_id)
        if data.get('revision')!=row['revision']:
            abort(409, description='Cet élément a changé. Rechargez-le avant de supprimer.')
        if data.get('confirmTitle')!=row['title']:
            abort(400, description='Retapez le titre pour confirmer la suppression et celle de son contenu.')
        db().execute('DELETE FROM journal WHERE id=?',(node_id,))
        db().commit()
        return jsonify(ok=True)
