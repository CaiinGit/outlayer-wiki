import copy
import io
import test_server
from PIL import Image
from server.store import connect


class SkillsTests(test_server.ServerTests):
    def graph(self):
        return dict(name='Affinité de test',nodes=[dict(id='a',name='Racine',x=200,y=200),dict(id='b',name='Suite',x=200,y=400)],edges=[{'from':'a','to':'b'}])

    def create_tree(self,graph=None):
        response=self.change('/api/admin/affinities',graph or self.graph())
        self.assertEqual(response.status_code,201,response.json)
        return response.json

    def test_snapshots_conflicts_hide_delete(self):
        row=self.create_tree();path='/api/admin/affinities/'+row['id'];public='/api/affinities/'+row['id']
        self.assertEqual(self.player.get(public).status_code,404)
        row=self.change(path+'/publish',dict(revision=row['revision'])).json
        self.assertEqual(self.player.get(public).json['tree']['name'],'Affinité de test')
        graph=dict(self.graph(),name='Nouveau brouillon')
        revision=row['revision'];row=self.change(path,dict(tree=graph,revision=revision),'PUT').json
        self.assertEqual(self.player.get(public).json['tree']['name'],'Affinité de test')
        self.assertEqual(self.change(path,dict(tree=graph,revision=revision),'PUT').status_code,409)
        row=self.change(path+'/hide',dict(revision=row['revision'])).json
        self.assertEqual(self.player.get(public).status_code,404)
        self.assertEqual(self.change(path,dict(revision=row['revision'],confirmName='wrong'),'DELETE').status_code,400)
        self.assertEqual(self.change(path,dict(revision=row['revision'],confirmName=graph['name']),'DELETE').status_code,200)

    def test_graph_validation_and_roles(self):
        for patch in [dict(edges=[{'from':'a','to':'b'},{'from':'b','to':'a'}]),dict(edges=[{'from':'a','to':'missing'}]),dict(edges=[{'from':'a','to':'a'}]),dict(color='red')]:
            self.assertEqual(self.change('/api/admin/affinities',dict(self.graph(),**patch)).status_code,400)
        graph=self.graph();graph['nodes'][1]['id']='a'
        self.assertEqual(self.change('/api/admin/affinities',graph).status_code,400)
        graph=self.graph();graph['nodes'][0]['points']=-1
        self.assertEqual(self.change('/api/admin/affinities',graph).status_code,400)
        self.assertEqual(self.app.test_client().get('/api/affinities').status_code,401)
        self.assertEqual(self.player.get('/api/admin/affinities').status_code,403)
        self.assertEqual(self.mj.post('/api/admin/affinities',json=self.graph(),headers={'Origin':'http://localhost'}).status_code,403)
        with connect(self.path) as db:db.execute("UPDATE users SET role='guest' WHERE id='player-test'")
        self.assertEqual(self.player.get('/api/affinities').status_code,403)

    def test_icon_visibility_and_size(self):
        image=io.BytesIO();Image.new('RGB',(500,500),'red').save(image,'PNG');image.seek(0)
        result=self.mj.post('/api/admin/images',data={'image':(image,'icon.png'),'purpose':'skill-icon'},headers={'Origin':'http://localhost','X-CSRF-Token':self.csrf})
        self.assertEqual(result.status_code,200,result.json)
        url=result.json['image'];graph=self.graph();graph['nodes'][0]['image']=url
        row=self.create_tree(graph);path='/api/admin/affinities/'+row['id']
        self.assertEqual(self.player.get(url).status_code,404)
        row=self.change(path+'/publish',dict(revision=row['revision'])).json
        response=self.player.get(url);self.assertEqual(response.status_code,200)
        self.assertEqual(Image.open(io.BytesIO(response.data)).size,(128,128))
        self.change(path+'/hide',dict(revision=row['revision']))
        self.assertEqual(self.player.get(url).status_code,404)

    def test_bounded_summaries(self):
        for i in range(21):self.create_tree(dict(self.graph(),name=str(i)))
        data=self.mj.get('/api/admin/affinities').json
        self.assertEqual((data['total'],data['pages'],len(data['items'])),(21,2,20))
        self.assertNotIn('draft',data['items'][0])
        self.assertEqual(self.player.get('/api/affinities').json['total'],0)

    def test_node_size_round_trip_and_legacy_default(self):
        row=self.create_tree()
        self.assertEqual(row['draft']['nodes'][0]['size'],64)
        graph=self.graph();graph['nodes'][0]['size']=128
        row=self.create_tree(graph)
        path='/api/admin/affinities/'+row['id']
        self.change(path+'/publish',dict(revision=row['revision']))
        self.assertEqual(self.player.get('/api/affinities/'+row['id']).json['tree']['nodes'][0]['size'],128)
        for size in [31,193,True,'64',64.5]:
            graph['nodes'][0]['size']=size
            self.assertEqual(self.change('/api/admin/affinities',graph).status_code,400)


for name in dir(test_server.ServerTests):
    if name.startswith('test_'):setattr(SkillsTests,name,None)
