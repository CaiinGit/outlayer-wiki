import io
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from werkzeug.security import generate_password_hash
from server.app import create_app
from server.store import connect, initialize
from server.manage import backup, restore


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'codex.sqlite')
        self.app = create_app(dict(TESTING=True, DB_PATH=self.path, ORIGIN='http://localhost'))
        with connect(self.path) as db:
            db.execute("INSERT INTO settings VALUES ('password', ?)", (generate_password_hash('test-password-only'),))
        self.mj = self.app.test_client()
        self.player = self.app.test_client()
        response = self.mj.post('/api/login', json={'password': 'test-password-only'}, headers={'Origin': 'http://localhost'})
        self.csrf = response.json['csrf']

    def tearDown(self):
        self.temp.cleanup()

    def change(self, path, data, method='POST'):
        return self.mj.open(path, method=method, json=data, headers={'Origin':'http://localhost', 'X-CSRF-Token':self.csrf})

    def draft(self, **extra):
        return dict(type='Personnages', name='Identité secrète', description='Histoire secrète', subtitle='Titre secret',
                    teaser='Indice secret', symbol='◇', details=['Détail secret'], tags=['Secret'], notes='Notes uniquement MJ',
                    image=None, relations=[], **extra)

    def create(self):
        response = self.change('/api/admin/entries', self.draft())
        self.assertEqual(response.status_code, 201)
        return response.json

    def action(self, row, action):
        response = self.change('/api/admin/entries/'+row['id']+'/'+action, {'revision':row['revision']})
        self.assertEqual(response.status_code, 200, response.json)
        return response.json

    def catalog(self):
        return self.player.get('/api/catalog').json['entries']

    def test_migration_once_and_only_noyau_known(self):
        self.assertEqual(len(self.catalog()), 7)
        self.assertEqual([e['name'] for e in self.catalog() if e['known']], ['Le Noyau'])
        row = self.create()
        initialize(self.path)
        self.assertEqual(len(self.mj.get('/api/admin/entries').json['entries']), 8)
        self.assertFalse(any(e['id']==row['id'] for e in self.catalog()))
        self.assertTrue(all(e['revealedAt'] is None for e in self.catalog()))

    def test_drafts_preview_snapshots_seal_and_hide(self):
        row = self.create()
        preview = self.mj.get('/api/admin/preview/'+row['id'])
        self.assertIn('Identité secrète', preview.get_data(as_text=True))
        self.assertNotIn('Notes uniquement MJ', preview.get_data(as_text=True))
        self.assertEqual(self.player.get('/api/admin/preview/'+row['id']).status_code,401)
        row = self.action(row, 'seal')
        public = json.dumps(self.catalog(), ensure_ascii=False)
        for secret in ['Identité secrète','Histoire secrète','Titre secret','Indice secret','Détail secret','Notes uniquement MJ']:
            self.assertNotIn(secret, public)
        row = self.action(row, 'publish')
        first_date = row['revealedAt']
        self.assertTrue(first_date)
        self.assertNotIn('Notes uniquement MJ', json.dumps(self.catalog(), ensure_ascii=False))
        updated = dict(row['draft'], name='Version suivante', revision=row['revision'])
        row = self.change('/api/admin/entries/'+row['id'], updated, 'PUT').json
        self.assertIn('Identité secrète', json.dumps(self.catalog(), ensure_ascii=False))
        self.assertNotIn('Version suivante', json.dumps(self.catalog(), ensure_ascii=False))
        row = self.action(row, 'publish')
        self.assertEqual(row['revealedAt'], first_date)
        self.assertIn('Version suivante', json.dumps(self.catalog(), ensure_ascii=False))
        row = self.action(row, 'hide')
        self.assertFalse(any(e['id']==row['id'] for e in self.catalog()))
        row = self.action(row, 'publish')
        self.assertGreater(row['revealedAt'], first_date)

    def test_relations_only_to_published_known_entries(self):
        first, second = self.create(), self.create()
        draft = dict(first['draft'], relations=[second['id'],'noyau'], revision=first['revision'])
        first = self.change('/api/admin/entries/'+first['id'], draft, 'PUT').json
        first = self.action(first, 'publish')
        item = self.player.get('/api/entries/'+first['id']).json['entry']
        self.assertEqual(item['relations'], ['noyau'])
        second = self.action(second, 'publish')
        self.assertIn(second['id'], self.player.get('/api/entries/'+first['id']).json['entry']['relations'])
        self.action(second, 'seal')
        self.assertNotIn(second['id'], self.player.get('/api/entries/'+first['id']).json['entry']['relations'])

    def test_auth_origin_csrf_logout_and_rate_limit(self):
        self.assertEqual(self.player.get('/api/admin/entries').status_code,401)
        self.assertEqual(self.mj.post('/api/admin/entries',json=self.draft(),headers={'Origin':'http://localhost'}).status_code,403)
        self.assertEqual(self.mj.post('/api/admin/entries',json=self.draft(),headers={'Origin':'https://attacker.invalid','X-CSRF-Token':self.csrf}).status_code,403)
        self.assertEqual(self.change('/api/admin/logout',{}).status_code,200)
        self.assertEqual(self.mj.get('/api/admin/entries').status_code,401)
        for _ in range(8):
            self.assertEqual(self.player.post('/api/login',json={'password':'wrong'},headers={'Origin':'http://localhost'}).status_code,401)
        self.assertEqual(self.player.post('/api/login',json={'password':'wrong'},headers={'Origin':'http://localhost'}).status_code,429)

    def test_revision_conflict_does_not_overwrite(self):
        row = self.create()
        draft = dict(row['draft'], name='Nouvelle version', revision=row['revision'])
        self.assertEqual(self.change('/api/admin/entries/'+row['id'],draft,'PUT').status_code,200)
        draft['name']='Version obsolète'
        self.assertEqual(self.change('/api/admin/entries/'+row['id'],draft,'PUT').status_code,409)
        self.assertEqual(self.change('/api/admin/entries/'+row['id']+'/publish',{'revision':row['revision']}).status_code,409)

    def test_images_private_until_publication_and_revoked_on_seal(self):
        raw=io.BytesIO(); Image.new('RGB',(600,300),'red').save(raw,'PNG'); raw.seek(0)
        response=self.mj.post('/api/admin/images',data={'image':(raw,'private.png')},headers={'Origin':'http://localhost','X-CSRF-Token':self.csrf})
        self.assertEqual(response.status_code,200)
        url=response.json['image']
        self.assertEqual(self.player.get(url).status_code,404)
        self.assertEqual(self.mj.get(url).mimetype,'image/webp')
        row=self.create()
        row=self.change('/api/admin/entries/'+row['id'],dict(row['draft'],image=url,revision=row['revision']),'PUT').json
        row=self.action(row,'publish')
        response=self.player.get(url)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.headers['Cache-Control'],'no-store')
        self.action(row,'seal')
        self.assertEqual(self.player.get(url).status_code,404)
        bad=self.mj.post('/api/admin/images',data={'image':(io.BytesIO(b'<svg onload="alert(1)"/>'),'bad.svg')},headers={'Origin':'http://localhost','X-CSRF-Token':self.csrf})
        self.assertEqual(bad.status_code,400)

    def test_invalid_data_and_no_private_files(self):
        for patch in [{'name':''},{'type':'Bogus'},{'image':'https://private/image.png'},{'image':'assets/../server/app.py'},{'relations':['missing']},{'notes':['bad']}]:
            draft=self.draft();draft.update(patch)
            self.assertEqual(self.change('/api/admin/entries',draft).status_code,400)
        for url in ['/server/app.py','/compose.yaml','/.env','/data/outlayer.sqlite','/requirements.txt','/assets/../server/app.py']:
            self.assertEqual(self.player.get(url).status_code,404,url)
        self.assertEqual(self.player.get('/data/codex.json').json,self.player.get('/api/catalog').json)

    def test_backup_restore_includes_images_and_clears_sessions(self):
        directory=Path(self.temp.name)/'backups'
        with connect(self.path) as db:
            db.execute('INSERT INTO images VALUES (?, ?)', ('backup-test', b'image-bytes'))
        snapshot=backup(self.path,directory)
        self.create()
        restore(self.path,snapshot,directory)
        self.assertEqual(self.mj.get('/api/admin/entries').status_code,401)
        with connect(self.path) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM entries').fetchone()[0],7)
            self.assertEqual(db.execute('SELECT body FROM images WHERE id=?', ('backup-test',)).fetchone()[0], b'image-bytes')
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')

    def test_setup_required_expiration_and_cookie_flags(self):
        with connect(self.path) as db:
            db.execute('DELETE FROM sessions')
        self.assertEqual(self.mj.get('/api/admin/entries').status_code, 401)
        response=self.mj.post('/api/login',json={'password':'test-password-only'},headers={'Origin':'http://localhost'})
        self.assertIn('HttpOnly',response.headers['Set-Cookie'])
        self.assertIn('SameSite=Strict',response.headers['Set-Cookie'])
        with connect(self.path) as db:
            db.execute('UPDATE sessions SET expires=0')
        self.assertEqual(self.mj.get('/api/admin/entries').status_code, 401)
        with connect(self.path) as db:
            db.execute("DELETE FROM settings WHERE key='password'")
        self.assertEqual(self.mj.post('/api/login',json={'password':'anything'},headers={'Origin':'http://localhost'}).status_code,503)


if __name__ == '__main__':
    unittest.main()
