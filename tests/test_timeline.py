import test_server
from pathlib import Path
from server.store import connect, initialize
from server.manage import backup,restore


class TimelineTests(test_server.ServerTests):
    def event(self,**extra):
        return dict(title='Ère de test',description='Récit de test',kind='era',start_year=-100,end_year=0,date_label='',position=1,visible=False,**extra)

    def create_event(self,data=None):
        result=self.change('/api/admin/timeline',data or self.event())
        self.assertEqual(result.status_code,201,result.json)
        return result.json

    def test_private_create_reveal_update_and_delete(self):
        row=self.create_event()
        self.assertEqual(self.player.get('/api/timeline').json['total'],0)
        self.assertEqual(self.player.get('/api/timeline/'+row['id']).status_code,404)
        data=dict(self.event(),revision=row['revision'],visible=True)
        result=self.change('/api/admin/timeline/'+row['id'],data,'PUT')
        self.assertEqual(result.status_code,200);row=result.json
        self.assertEqual(self.player.get('/api/timeline/'+row['id']).json['start_year'],-100)
        self.assertEqual(self.player.get('/api/timeline?q=ere').json['total'],1)
        self.assertEqual(self.change('/api/admin/timeline/'+row['id'],data,'PUT').status_code,409)
        self.assertEqual(self.change('/api/admin/timeline/'+row['id'],dict(revision=row['revision'],confirmTitle='wrong'),'DELETE').status_code,400)
        self.assertEqual(self.change('/api/admin/timeline/'+row['id'],dict(revision=row['revision'],confirmTitle=row['title']),'DELETE').status_code,200)
        self.assertEqual(self.player.get('/api/timeline/'+row['id']).status_code,404)

    def test_import_is_private_atomic_and_preserves_edits(self):
        event=dict(self.event(),source_key='notion:test:one',visible=True)
        data=dict(version=1,events=[event])
        self.assertEqual(self.change('/api/admin/timeline/import',data).json,dict(added=1,skipped=0))
        self.assertEqual(self.player.get('/api/timeline').json['total'],0)
        row=self.mj.get('/api/admin/timeline').json['items'][0]
        self.change('/api/admin/timeline/'+row['id'],dict(event,title='Titre modifié',revision=row['revision']),'PUT')
        self.assertEqual(self.change('/api/admin/timeline/import',data).json,dict(added=0,skipped=1))
        self.assertEqual(self.mj.get('/api/admin/timeline/'+row['id']).json['title'],'Titre modifié')
        invalid=dict(version=1,events=[dict(event,source_key='new'),dict(event,source_key='invalid',end_year=-101)])
        self.assertEqual(self.change('/api/admin/timeline/import',invalid).status_code,400)
        self.assertEqual(self.mj.get('/api/admin/timeline').json['total'],1)
        self.assertEqual(self.change('/api/admin/timeline/import',dict(version=1,events=[event,event])).status_code,400)

    def test_roles_csrf_and_dates(self):
        self.assertEqual(self.app.test_client().get('/api/timeline').status_code,401)
        self.assertEqual(self.player.get('/api/admin/timeline').status_code,403)
        self.assertEqual(self.player.post('/api/admin/timeline/import',json={},headers={'Origin':'http://localhost'}).status_code,403)
        with connect(self.path) as db:db.execute("UPDATE users SET role='guest' WHERE id='player-test'")
        self.assertEqual(self.player.get('/api/timeline').status_code,403)
        self.assertEqual(self.mj.post('/api/admin/timeline',json=self.event(),headers={'Origin':'http://localhost'}).status_code,403)
        for patch in [dict(start_year=True),dict(end_year=-101),dict(start_year=None,end_year=1),dict(position=0),dict(kind='bad'),dict(visible='yes'),dict(description='x'*30001)]:
            self.assertEqual(self.change('/api/admin/timeline',dict(self.event(),**patch)).status_code,400)
        row=self.create_event(dict(self.event(),start_year=None,end_year=None,date_label='Date inconnue'))
        self.assertIsNone(row['start_year'])
        self.assertEqual(row['date_label'],'Date inconnue')

    def test_bounded_lists_and_backup_migration(self):
        for i in range(25):
            self.create_event(dict(self.event(),title='Repère '+str(i),position=i+1,description='Long récit. '*1000,visible=True))
        data=self.player.get('/api/timeline').json
        self.assertEqual((data['total'],data['pages'],len(data['items'])),(25,2,20))
        self.assertLessEqual(len(data['items'][0]['description']),240)
        row=data['items'][0]
        self.assertGreater(len(self.player.get('/api/timeline/'+row['id']).json['description']),10000)
        self.assertNotIn('source_key',row)
        self.assertEqual(len(self.player.get('/api/timeline?page=99').json['items']),5)
        self.assertEqual(self.mj.get('/api/admin/timeline').json['nextPosition'],26)
        directory=Path(self.temp.name)/'backups';snapshot=backup(self.path,directory)
        with connect(self.path) as db:db.execute('DELETE FROM timeline')
        restore(self.path,snapshot,directory);initialize(self.path)
        with connect(self.path) as db:self.assertEqual(db.execute('SELECT count(*) FROM timeline').fetchone()[0],25)


for name in dir(test_server.ServerTests):
    if name.startswith('test_'):setattr(TimelineTests,name,None)
