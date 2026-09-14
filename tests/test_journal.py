import test_server
from server.store import connect, initialize
from server.manage import backup, restore
from pathlib import Path


class JournalTests(test_server.ServerTests):
    def add(self,kind,title,parent=None,**extra):
        response=self.change('/api/admin/journal',dict(kind=kind,parent_id=parent,title=title,description='',position=1,**extra))
        self.assertEqual(response.status_code,201,response.json)
        return response.json

    def test_initial_fable_two_sessions_and_one_time_migration(self):
        fables=self.player.get('/api/journal').json['items']
        self.assertEqual([(r['title'],r['kind']) for r in fables],[('I','fable')])
        sessions=self.player.get('/api/journal?kind=session&parent=arc-1').json
        self.assertEqual([r['title'] for r in sessions['items']],['Session 1','Session 2'])
        self.assertTrue(all(r['description']=='' and r['played_on']=='' for r in sessions['items']))
        row=self.mj.get('/api/admin/journal/session-2').json
        self.assertEqual(self.change('/api/admin/journal/session-2',dict(revision=row['revision'],confirmTitle=row['title']),'DELETE').status_code,200)
        initialize(self.path)
        self.assertEqual(self.player.get('/api/journal?kind=session&parent=arc-1').json['total'],1)

    def test_visibility_requires_every_ancestor(self):
        fable=self.add('fable','Secret Fable')
        arc=self.add('arc','Secret Arc',fable['id'],visible=True)
        session=self.add('session','Secret Session',arc['id'],visible=True)
        self.assertNotIn('Secret',self.player.get('/api/journal').get_data(as_text=True))
        for node in [fable,arc,session]:
            self.assertEqual(self.player.get('/api/journal/'+node['id']).status_code,404)
        self.assertEqual(self.player.get('/api/journal?kind=session&parent='+arc['id']).status_code,404)
        fable=self.change('/api/admin/journal/'+fable['id'],dict(fable,visible=True),'PUT').json
        self.assertEqual(self.player.get('/api/journal/'+session['id']).status_code,200)
        self.change('/api/admin/journal/'+arc['id'],dict(arc,visible=False),'PUT')
        self.assertEqual(self.player.get('/api/journal/'+session['id']).status_code,404)

    def test_permissions_csrf_validation_conflict_and_cascade(self):
        anonymous=self.app.test_client()
        self.assertEqual(anonymous.get('/api/journal').status_code,401)
        with connect(self.path) as db:
            db.execute("UPDATE users SET role='guest' WHERE id='player-test'")
        self.assertEqual(self.player.get('/api/journal').status_code,403)
        self.assertEqual(self.player.get('/api/admin/journal').status_code,403)
        self.assertEqual(self.mj.post('/api/admin/journal',json={},headers={'Origin':'http://localhost'}).status_code,403)
        bad=dict(kind='session',parent_id='fable-i',title='Invalid',position=1)
        self.assertEqual(self.change('/api/admin/journal',bad).status_code,400)
        for extra in [{'title':''},{'position':0},{'visible':'yes'},{'played_on':'2026-02-30'},{'description':'x'*30001}]:
            self.assertEqual(self.change('/api/admin/journal',dict(bad,parent_id='arc-1',**extra)).status_code,400)
        row=self.mj.get('/api/admin/journal/fable-i').json
        self.assertEqual(self.change('/api/admin/journal/fable-i',dict(row,revision=0),'PUT').status_code,409)
        self.assertEqual(self.change('/api/admin/journal/fable-i',dict(revision=row['revision'],confirmTitle='wrong'),'DELETE').status_code,400)
        self.assertEqual(self.change('/api/admin/journal/fable-i',dict(revision=row['revision'],confirmTitle='I'),'DELETE').status_code,200)
        with connect(self.path) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM journal').fetchone()[0],0)
        initialize(self.path)
        self.assertEqual(self.mj.get('/api/admin/journal').json['total'],0)

    def test_pagination_order_full_description_and_backup(self):
        for i in range(24):
            self.add('session','Extra '+str(i),'arc-1',visible=True)
        row=self.mj.get('/api/admin/journal/session-2').json
        row=self.change('/api/admin/journal/session-2',dict(row,description='Un récit. '*1000,position=99,played_on='2026-09-12',status='planned'),'PUT').json
        page=self.player.get('/api/journal?kind=session&parent=arc-1').json
        self.assertEqual((len(page['items']),page['total'],page['pages']),(20,26,2))
        last=self.player.get('/api/journal?kind=session&parent=arc-1&page=999').json
        self.assertEqual(last['items'][-1]['id'],'session-2')
        self.assertEqual(self.mj.get('/api/admin/journal?kind=session&parent=arc-1').json['nextPosition'],100)
        self.assertEqual(len(last['items'][-1]['description']),180)
        detail=self.player.get('/api/journal/session-2').json
        self.assertGreater(len(detail['description']),9000)
        self.assertNotIn('revision',detail)
        directory=Path(self.temp.name)/'journal-backup'
        snapshot=backup(self.path,directory)
        self.change('/api/admin/journal/session-2',dict(revision=row['revision'],confirmTitle=row['title']),'DELETE')
        restore(self.path,snapshot,directory)
        with connect(self.path) as db:
            self.assertEqual(db.execute("SELECT title FROM journal WHERE id='session-2'").fetchone()[0],'Session 2')


for name in dir(test_server.ServerTests):
    if name.startswith('test_'):
        setattr(JournalTests,name,None)
