"""Versioned affinity graphs with independently published player snapshots."""
import json
import re
import uuid
from datetime import datetime, timezone
from flask import abort,jsonify,request

MAX_NODES=200
MAX_EDGES=600


def migrate_skills(db):
    db.execute('CREATE TABLE IF NOT EXISTS affinities (id TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)')


def validate_graph(value,db):
    def text(source,key,limit,default=''):
        v=source.get(key,default)
        if not isinstance(v,str) or len(v)>limit:abort(400,description='Champ invalide : '+key)
        return v.strip()
    def image(source):
        value=source.get('image')
        if value is None:return None
        if not isinstance(value,str) or not re.fullmatch(r'/api/images/[a-f0-9]{32}',value) or not db.execute('SELECT 1 FROM images WHERE id=?',(value.rsplit('/',1)[1],)).fetchone():
            abort(400,description='Importez une image valide depuis l’atelier.')
        return value
    if not isinstance(value,dict):abort(400,description='Arbre invalide.')
    name=text(value,'name',120)
    if not name:abort(400,description='Le nom de l’Affinité est obligatoire.')
    color=text(value,'color',7,'#c6a66a')
    if not re.fullmatch(r'#[a-fA-F0-9]{6}',color):abort(400,description='Couleur invalide.')
    nodes=value.get('nodes',[]);edges=value.get('edges',[])
    if not isinstance(nodes,list) or len(nodes)>MAX_NODES or not isinstance(edges,list) or len(edges)>MAX_EDGES:
        abort(400,description='Un arbre peut contenir au maximum 200 compétences et 600 liens.')
    clean=[];ids=set()
    for node in nodes:
        if not isinstance(node,dict):abort(400,description='Compétence invalide.')
        node_id=text(node,'id',64)
        if not re.fullmatch(r'[a-z0-9-]{1,64}',node_id) or node_id in ids:abort(400,description='Identifiant de compétence invalide ou dupliqué.')
        ids.add(node_id)
        n={key:text(node,key,limit) for key,limit in [('name',120),('description',5000),('acquisition',2000),('usage',3000),('cost',500),('cooldown',300),('range',300)]}
        if not n['name']:abort(400,description='Chaque compétence doit avoir un nom.')
        for key,maximum in [('x',2400),('y',1800)]:
            pos=node.get(key,120)
            if type(pos) is not int or not 60<=pos<=maximum-60:abort(400,description='Placez les compétences à l’intérieur de l’arbre.')
            n[key]=pos
        points=node.get('points',1)
        if type(points) is not int or not 0<=points<=999:abort(400,description='Le coût de déblocage doit être compris entre 0 et 999 points.')
        kind=node.get('kind','active');mode=node.get('requirement_mode','all')
        if kind not in ('active','passive','ultimate') or mode not in ('all','any'):abort(400,description='Type ou règle de prérequis invalide.')
        n.update(id=node_id,kind=kind,requirement_mode=mode,points=points,symbol=text(node,'symbol',8,'✦'),image=image(node))
        clean.append(n)
    links=[];seen=set();degree={node_id:0 for node_id in ids};children={node_id:[] for node_id in ids}
    for edge in edges:
        if not isinstance(edge,dict):abort(400,description='Lien invalide.')
        source,target=edge.get('from'),edge.get('to')
        if not isinstance(source,str) or not isinstance(target,str) or source not in ids or target not in ids or source==target or (source,target) in seen:
            abort(400,description='Lien invalide, dupliqué ou vers une compétence absente.')
        seen.add((source,target));degree[target]+=1;children[source].append(target);links.append({'from':source,'to':target})
    queue=[key for key in ids if degree[key]==0];visited=0
    while queue:
        key=queue.pop();visited+=1
        for child in children[key]:
            degree[child]-=1
            if degree[child]==0:queue.append(child)
    if visited!=len(ids):abort(400,description='Ce lien crée une boucle de prérequis. L’arbre doit pouvoir être débloqué depuis ses racines.')
    return dict(name=name,description=text(value,'description',5000),color=color,symbol=text(value,'symbol',8,'✦'),image=image(value),nodes=clean,edges=links)


def register_skills(app,db,private,payload):
    def row(affinity_id):
        result=db().execute('SELECT * FROM affinities WHERE id=?',(affinity_id,)).fetchone()
        if not result:abort(404,description='Cette Affinité n’existe plus.')
        return result
    def admin_item(r):
        return dict(id=r['id'],draft=json.loads(r['draft']),revision=r['revision'],published=r['published'] is not None)
    def listing(admin=False):
        try:number=max(1,int(request.args.get('page','1')))
        except ValueError:abort(400)
        field='draft' if admin else 'published';where='1=1' if admin else 'published IS NOT NULL'
        db().execute('BEGIN')
        total=db().execute('SELECT count(*) FROM affinities WHERE '+where).fetchone()[0];pages=max(1,(total+19)//20);number=min(number,pages)
        rows=db().execute(f"SELECT id,json_extract({field},'$.name') AS name,json_extract({field},'$.color') AS color,json_extract({field},'$.symbol') AS symbol,published IS NOT NULL AS published FROM affinities WHERE {where} ORDER BY name,id LIMIT 20 OFFSET ?",((number-1)*20,)).fetchall()
        items=[{key:r[key] for key in ('id','name','color','symbol')}|({'published':bool(r['published'])} if admin else {}) for r in rows]
        return jsonify(items=items,total=total,page=number,pages=pages)

    @app.get('/api/affinities')
    def affinity_list():return listing()

    @app.get('/api/affinities/<affinity_id>')
    def affinity_detail(affinity_id):
        r=row(affinity_id)
        if not r['published']:abort(404,description='Cette Affinité n’est pas disponible.')
        return jsonify(id=r['id'],tree=json.loads(r['published']))

    @app.get('/api/admin/affinities')
    @private
    def affinity_admin_list():return listing(True)

    @app.get('/api/admin/affinities/<affinity_id>')
    @private
    def affinity_admin_detail(affinity_id):return jsonify(admin_item(row(affinity_id)))

    @app.post('/api/admin/affinities')
    @private
    def affinity_create():
        graph=validate_graph(payload(),db());affinity_id=uuid.uuid4().hex
        db().execute('INSERT INTO affinities VALUES (?,?,NULL,1,?)',(affinity_id,json.dumps(graph,ensure_ascii=False),datetime.now(timezone.utc).isoformat()));db().commit()
        return jsonify(admin_item(row(affinity_id))),201

    @app.put('/api/admin/affinities/<affinity_id>')
    @private
    def affinity_save(affinity_id):
        data=payload();graph=validate_graph(data.get('tree'),db())
        result=db().execute('UPDATE affinities SET draft=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',(json.dumps(graph,ensure_ascii=False),datetime.now(timezone.utc).isoformat(),affinity_id,data.get('revision')))
        if result.rowcount!=1:db().rollback();abort(409,description='Cet arbre a changé. Rechargez-le avant d’enregistrer.')
        db().commit();return jsonify(admin_item(row(affinity_id)))

    @app.post('/api/admin/affinities/<affinity_id>/<action>')
    @private
    def affinity_publish(affinity_id,action):
        if action not in ('publish','hide'):abort(404)
        data=payload();db().execute('BEGIN IMMEDIATE');r=row(affinity_id)
        if data.get('revision')!=r['revision']:abort(409,description='Cet arbre a changé. Rechargez-le.')
        db().execute('UPDATE affinities SET published=?,revision=revision+1 WHERE id=?',(r['draft'] if action=='publish' else None,affinity_id));db().commit()
        return jsonify(admin_item(row(affinity_id)))

    @app.delete('/api/admin/affinities/<affinity_id>')
    @private
    def affinity_delete(affinity_id):
        data=payload();db().execute('BEGIN IMMEDIATE');r=row(affinity_id)
        if data.get('revision')!=r['revision']:abort(409,description='Cet arbre a changé. Rechargez-le.')
        if data.get('confirmName')!=json.loads(r['draft'])['name']:abort(400,description='Retapez le nom de l’Affinité pour supprimer son arbre.')
        db().execute('DELETE FROM affinities WHERE id=?',(affinity_id,));db().commit();return jsonify(ok=True)
