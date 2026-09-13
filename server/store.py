import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from .browse import migrate_index
from .teasers import make_teaser

TYPES = ['Lieux', 'Personnages', 'Factions', 'Bestiaire', 'Artefacts', 'Utilitaires', 'Divinités']
SEALED = 'assets/codex/sealed.svg'
ROOT = Path(__file__).resolve().parent.parent


def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')


class Connection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def connect(path):
    db = sqlite3.connect(path, timeout=15, factory=Connection)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('BEGIN IMMEDIATE')
        version = db.execute('PRAGMA user_version').fetchone()[0]
        if version not in (0, 1, 2):
            raise RuntimeError('Version de base non prise en charge')
        db.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT, revision INTEGER NOT NULL DEFAULT 1, revealed_at TEXT, updated_at TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, body BLOB NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires REAL NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS attempts (address TEXT PRIMARY KEY, count INTEGER NOT NULL, expires REAL NOT NULL)')
        if not db.execute("SELECT 1 FROM settings WHERE key='seeded'").fetchone():
            seed = json.loads((ROOT / 'data/codex.json').read_text(encoding='utf-8'))
            for item in seed['entries']:
                draft = {k: v for k, v in item.items() if k not in ('known', 'visible')}
                draft.update(notes='', relations=[])
                published = public_item(item['id'], draft, item['known']) if item['visible'] else None
                db.execute('INSERT INTO entries VALUES (?, ?, ?, 1, NULL, ?)', (item['id'], json.dumps(draft, ensure_ascii=False), json.dumps(published, ensure_ascii=False) if published else None, now()))
            db.execute("INSERT INTO settings VALUES ('seeded', '1')")
        if version < 2:
            migrate_index(db)
        if not db.execute("SELECT 1 FROM settings WHERE key='teaser-migration-v1'").fetchone():
            for row in db.execute("SELECT id,draft,published FROM entries WHERE json_extract(published, '$.known')=0").fetchall():
                public = json.loads(row['published'])
                image = make_teaser(db, json.loads(row['draft']).get('image'))
                if image != public['image']:
                    public['image'] = image
                    db.execute('UPDATE entries SET published=?,revision=revision+1 WHERE id=?', (json.dumps(public, ensure_ascii=False), row['id']))
            db.execute("INSERT INTO settings VALUES ('teaser-migration-v1','1')")
        db.execute('PRAGMA user_version=2')
    if os.name != 'nt':
        os.chmod(path, 0o600)


def public_item(entry_id, draft, known=True):
    if not known:
        return dict(id=entry_id, type=draft['type'], name='???', description='', known=False, visible=True,
                    image=SEALED, subtitle='Archive non découverte', teaser='Cette archive se dévoilera au fil de votre aventure.',
                    symbol='?', details=[], tags=['inconnu'], relations=[])
    result = {k: draft[k] for k in ('type', 'name', 'description', 'image', 'subtitle', 'teaser', 'symbol', 'details', 'tags', 'relations')}
    result.update(id=entry_id, known=True, visible=True)
    return result
