import sqlite3
from pathlib import Path
import test_server
from server.store import connect, initialize
from werkzeug.security import generate_password_hash


class AccountTests(test_server.ServerTests):
    def test_rename_preserves_identity_password_and_session(self):
        before=self.player.get('/api/session').json['user']
        response=self.change('/api/admin/users/player-test',{'username':'Valentin'},'PUT')
        self.assertEqual(response.status_code,200)
        self.assertFalse(response.json['sessionsRevoked'])
        after=self.player.get('/api/session').json['user']
        self.assertEqual(after,dict(before,username='Valentin'))
        client=self.app.test_client()
        for name,code in [('player',401),('valentin',200)]:
            self.assertEqual(client.post('/api/login',json={'username':name,'password':'player-password-only'},headers={'Origin':'http://localhost'}).status_code,code)
        mj=self.mj.get('/api/session').json['user']
        self.assertEqual(self.change('/api/admin/users/'+mj['id'],{'username':'GameMaster'},'PUT').status_code,200)
        self.assertEqual(self.mj.get('/api/admin/users').status_code,200)

    def test_rename_validation_conflict_and_permission(self):
        self.change('/api/admin/users',{'username':'Taken','password':'another-password','role':'guest'})
        for name,code in [('taken',409),('',400),('ab',400),('name with spaces',400),('x'*41,400),(None,400)]:
            self.assertEqual(self.change('/api/admin/users/player-test',{'username':name,'role':'mj'},'PUT').status_code,code)
        self.assertEqual(self.player.get('/api/session').json['user']['username'],'player')
        self.assertEqual(self.player.get('/api/session').json['user']['role'],'player')
        csrf=self.player.get('/api/session').json['csrf']
        self.assertEqual(self.player.put('/api/admin/users/player-test',json={'username':'NewName'},headers={'Origin':'http://localhost','X-CSRF-Token':csrf}).status_code,403)

    def signup(self, name='new-player'):
        client=self.app.test_client()
        response=client.post('/api/register', json={'username':name,'password':'new-password-only','role':'mj'},headers={'Origin':'http://localhost'})
        self.assertEqual(response.status_code,201,response.json)
        response=client.post('/api/login',json={'username':name,'password':'new-password-only'},headers={'Origin':'http://localhost'})
        self.assertEqual(response.status_code,200)
        return client,response.json

    def test_signup_guest_then_mj_approval(self):
        guest,session=self.signup()
        self.assertEqual(session['user']['role'],'guest')
        with guest.get('/') as response:
            self.assertEqual(response.status_code,200)
        for client,code in [(guest,403),(self.app.test_client(),401)]:
            for url in ['/api/catalog','/data/codex.json','/api/entries/noyau','/assets/codex/sealed.svg','/api/images/abcdef','/api/teasers/abcdef','/api/admin/users','/api/admin/entries','/api/admin/preview/noyau']:
                self.assertEqual(client.get(url).status_code,code,url)
        response=self.change('/api/admin/users/'+session['user']['id'],{'role':'player'},'PUT')
        self.assertEqual(response.status_code,200)
        self.assertEqual(guest.get('/api/catalog').status_code,401)
        guest.post('/api/login',json={'username':'new-player','password':'new-password-only'},headers={'Origin':'http://localhost'})
        self.assertEqual(guest.get('/api/catalog').status_code,200)
        self.assertEqual(guest.get('/api/admin/entries').status_code,403)
        self.assertEqual(guest.get('/api/admin/users').status_code,403)
        self.assertEqual(guest.get('/api/entries/noyau').status_code,200)

    def test_account_management_permissions_and_last_mj(self):
        user=self.mj.get('/api/session').json['user']
        for data in [{'active':False},{'role':'player'}]:
            self.assertEqual(self.change('/api/admin/users/'+user['id'],data,'PUT').status_code,409)
        self.assertEqual(self.change('/api/admin/users',{'username':'Another','password':'another-password','role':'player'}).status_code,201)
        self.assertEqual(self.change('/api/admin/users',{'username':'another','password':'another-password','role':'player'}).status_code,409)
        csrf=self.player.get('/api/session').json['csrf']
        self.assertEqual(self.player.post('/api/admin/users',json={'username':'evil','password':'evil-password','role':'mj'},headers={'Origin':'http://localhost','X-CSRF-Token':csrf}).status_code,403)
        self.assertEqual(self.mj.post('/api/admin/users',json={},headers={'Origin':'http://localhost'}).status_code,403)
        self.assertNotIn('password',self.mj.get('/api/admin/users').get_data(as_text=True))
        self.assertEqual(self.change('/api/admin/users/player-test',{'active':False},'PUT').status_code,200)
        self.assertEqual(self.player.get('/api/catalog').status_code,401)
        self.assertEqual(self.player.post('/api/login',json={'username':'player','password':'player-password-only'},headers={'Origin':'http://localhost'}).status_code,401)

    def test_password_change_and_logout_revoke_sessions(self):
        csrf=self.player.get('/api/session').json['csrf']
        headers={'Origin':'http://localhost','X-CSRF-Token':csrf}
        self.assertEqual(self.player.post('/api/account/password',json={'currentPassword':'wrong','password':'new-password-only'},headers=headers).status_code,400)
        self.assertEqual(self.player.post('/api/account/password',json={'currentPassword':'player-password-only','password':'new-password-only'},headers=headers).status_code,200)
        self.assertEqual(self.player.get('/api/catalog').status_code,401)
        login=self.player.post('/api/login',json={'username':'player','password':'new-password-only'},headers={'Origin':'http://localhost'})
        self.assertEqual(login.status_code,200)
        self.assertEqual(self.player.post('/api/logout',json={},headers={'Origin':'http://localhost','X-CSRF-Token':login.json['csrf']}).status_code,200)
        self.assertIsNone(self.player.get('/api/session').json['user'])

    def test_legacy_mj_migration_preserves_hash_and_clears_old_sessions(self):
        path=Path(self.temp.name)/'legacy.sqlite'
        hashed=generate_password_hash('legacy-password')
        with sqlite3.connect(path) as db:
            db.execute('CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)')
            db.execute('INSERT INTO settings VALUES (?,?)',('password',hashed))
            db.execute('CREATE TABLE sessions (token TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires REAL NOT NULL)')
            db.execute("INSERT INTO sessions VALUES ('old','csrf',99999999999)")
        db.close()
        initialize(path);initialize(path)
        with connect(path) as db:
            row=db.execute('SELECT * FROM users').fetchone()
            self.assertEqual((row['username'],row['password'],row['role']),('mj',hashed,'mj'))
            self.assertEqual(db.execute('SELECT count(*) FROM sessions').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT count(*) FROM entries').fetchone()[0],7)
            self.assertFalse(db.execute("SELECT 1 FROM settings WHERE key='password'").fetchone())

    def test_registration_limits_validation_and_user_pagination(self):
        guest=self.app.test_client()
        for i in range(5):
            self.assertEqual(guest.post('/api/register',json={'username':'guest-'+str(i),'password':'registration-pass'},headers={'Origin':'http://localhost'}).status_code,201)
        self.assertEqual(guest.post('/api/register',json={'username':'guest-extra','password':'registration-pass'},headers={'Origin':'http://localhost'}).status_code,429)
        with connect(self.path) as db:
            hashed=generate_password_hash('unused-password')
            db.executemany("INSERT INTO users VALUES (?,?,?,'guest',1)",[(str(i),'bulk-'+str(i),hashed) for i in range(50)])
        data=self.mj.get('/api/admin/users?q=bulk').json
        self.assertEqual((len(data['users']),data['total'],data['pages']),(20,50,3))
        self.assertEqual(len(self.mj.get('/api/admin/users?q=bulk&page=3').json['users']),10)


for name in dir(test_server.ServerTests):
    if name.startswith('test_'):
        setattr(AccountTests,name,None)
