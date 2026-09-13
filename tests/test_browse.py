import json
import test_server
from server.store import connect, initialize, public_item
from server.browse import index_entry


class BrowsingTests(test_server.ServerTests):
    # Inherit setup helpers, not the original suite (filtered by unittest below).
    def populate(self, count=1001):
        with connect(self.path) as db:
            for i in range(count):
                draft=self.draft()
                draft.update(name=f'Crête {i:04}', description='corps-recherchable '+('Détail long. '*300), notes='note-invisible-joueurs', tags=['épopée'])
                entry_id=f'scale-{i:04}'
                public=public_item(entry_id,draft)
                db.execute('INSERT INTO entries VALUES (?,?,?,1,NULL,?)',(entry_id,json.dumps(draft),json.dumps(public),'2026-09-13T00:00:00'))
                index_entry(db,entry_id)

    def test_large_catalog_limits_summary_payload_and_cross_page_search(self):
        self.populate()
        response=self.player.get('/api/catalog?q=crete&sort=name')
        data=response.json
        self.assertEqual((len(data['entries']),data['total'],data['pages']),(24,1001,42))
        self.assertTrue(all(e['description']=='' and e['details']==[] for e in data['entries']))
        self.assertNotIn('Détail long',response.get_data(as_text=True))
        self.assertLess(len(response.data),25000)
        second=self.player.get('/api/catalog?q=crete&sort=name&page=2').json
        self.assertFalse({e['id'] for e in data['entries']} & {e['id'] for e in second['entries']})
        found=self.player.get('/api/catalog?q=crete+1000').json
        self.assertEqual(found['total'],1)
        detail=self.player.get('/api/entries/'+found['entries'][0]['id']).json
        self.assertIn('Détail long',detail['entry']['description'])
        self.assertNotIn('notes',detail['entry'])
        self.assertEqual(self.player.get('/api/catalog?q=corps-recherchable').json['total'],1001)
        self.assertEqual(self.player.get('/api/catalog?q=epopee').json['total'],1001)
        self.assertEqual(self.player.get('/api/catalog?q=note-invisible-joueurs').json['total'],0)
        self.assertEqual(sum(e['total'] for e in found['progress']),1008)
        admin=self.mj.get('/api/admin/entries?q=note-invisible-joueurs').json
        self.assertEqual((len(admin['entries']),admin['total']),(30,1001))
        self.assertTrue(all('draft' not in row and 'published' not in row for row in admin['entries']))
        lookup=self.mj.get('/api/admin/lookup?q=crete').json
        self.assertEqual(len(lookup['entries']),10)
        single=self.mj.get('/api/admin/entries/scale-1000').json
        self.assertEqual(single['draft']['notes'],'note-invisible-joueurs')

    def test_filters_boundaries_and_index_updates(self):
        self.populate(35)
        self.assertEqual(self.player.get('/api/catalog?q=crete&page=999999').json['page'],2)
        self.assertEqual(self.player.get('/api/catalog?page=-3').json['page'],1)
        self.assertEqual(self.player.get('/api/catalog?q=%25').json['total'],0)
        for suffix in ['page=no','sort=DROP+TABLE','state=hidden','type=bogus','q='+('x'*201)]:
            self.assertEqual(self.player.get('/api/catalog?'+suffix).status_code,400)
        row=self.mj.get('/api/admin/entries/scale-0000').json
        row=self.action(row,'seal')
        self.assertEqual(self.player.get('/api/entries/scale-0000').status_code,404)
        self.assertEqual(self.player.get('/api/catalog?q=crete+0000').json['total'],0)
        self.assertEqual(self.mj.get('/api/admin/entries?q=crete+0000&state=sealed').json['total'],1)
        row=self.action(row,'hide')
        self.assertEqual(self.player.get('/api/catalog?state=locked').json['total'],6)
        self.assertEqual(self.mj.get('/api/admin/lookup?q=crete+0000&exclude=scale-0000').json['total'],0)
        row=self.action(row,'publish')
        self.assertEqual(self.player.get('/api/catalog').json['recent'][0]['id'],row['id'])

    def test_version_one_upgrade_preserves_drafts_and_sessions(self):
        row=self.create()
        with connect(self.path) as db:
            db.execute('DROP TABLE browse_index')
            db.execute('PRAGMA user_version=1')
        initialize(self.path)
        self.assertEqual(self.mj.get('/api/admin/entries?q=histoire+secrete').json['total'],1)
        self.assertEqual(self.mj.get('/api/admin/entries/'+row['id']).json['draft'],row['draft'])
        self.assertEqual(len(self.catalog()),7)


# Run the shared suite once in test_server, keep only new scenarios here.
for name in dir(test_server.ServerTests):
    if name.startswith('test_'):
        setattr(BrowsingTests,name,None)
