"""Bounded SQL browsing; full documents are read only by detail endpoints."""
import json
import math
import unicodedata


def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.casefold()) if not unicodedata.combining(c))


def search_text(item, private=False):
    fields = [item.get(k, '') for k in ('name', 'type', 'subtitle', 'teaser', 'description')]
    fields += item.get('details', []) + item.get('tags', [])
    if private:
        fields.append(item.get('notes', ''))
    return fold(' '.join(fields))


def index_entry(db, entry_id):
    row = db.execute('SELECT draft,published FROM entries WHERE id=?', (entry_id,)).fetchone()
    draft = json.loads(row['draft'])
    public = json.loads(row['published']) if row['published'] else None
    state = 'known' if public and public['known'] else 'sealed' if public else 'hidden'
    db.execute('INSERT OR REPLACE INTO browse_index VALUES (?,?,?,?,?,?,?,?,?)',
               (entry_id, public['type'] if public else None, state, fold(public['name']) if public else '',
                search_text(public) if public else '', draft['type'], fold(draft['name']), draft['name'], search_text(draft, True)))


def migrate_index(db):
    db.execute('CREATE TABLE IF NOT EXISTS browse_index (id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE, public_type TEXT, state TEXT NOT NULL, public_name TEXT NOT NULL, public_search TEXT NOT NULL, draft_type TEXT NOT NULL, draft_name TEXT NOT NULL, name TEXT NOT NULL, draft_search TEXT NOT NULL)')
    db.execute('CREATE INDEX IF NOT EXISTS browse_public ON browse_index(state,public_type,public_name,id)')
    db.execute('CREATE INDEX IF NOT EXISTS browse_draft ON browse_index(draft_type,draft_name,id)')
    db.execute('CREATE INDEX IF NOT EXISTS entries_updated ON entries(updated_at DESC,id)')
    db.execute('CREATE INDEX IF NOT EXISTS entries_revealed ON entries(revealed_at DESC,id)')
    for row in db.execute('SELECT id FROM entries').fetchall():
        index_entry(db, row['id'])


BRIEF = """e.id, json_extract(e.published,'$.type') AS type,
json_extract(e.published,'$.name') AS name, json_extract(e.published,'$.known') AS known,
json_extract(e.published,'$.subtitle') AS subtitle, json_extract(e.published,'$.teaser') AS teaser,
json_extract(e.published,'$.symbol') AS symbol, json_extract(e.published,'$.image') AS image,
e.revealed_at AS revealedAt"""


def brief(row):
    item = dict(row)
    item.update(known=bool(item['known']), visible=True, description='', details=[], tags=[], relations=[])
    return item


def related(db, ids, private=False):
    if not ids:
        return []
    placeholders = ','.join('?' for _ in ids)
    if private:
        return [dict(row) for row in db.execute(f'SELECT id,name,draft_type AS type FROM browse_index WHERE id IN ({placeholders}) ORDER BY draft_name,id', ids)]
    return [brief(row) for row in db.execute(f"SELECT {BRIEF} FROM entries e JOIN browse_index b ON b.id=e.id WHERE b.state='known' AND e.id IN ({placeholders}) ORDER BY b.public_name,e.id", ids)]


def page(db, *, number=1, query='', category='', state='all', sort='recent', private=False, lookup=False, exclude=''):
    size = 10 if lookup else 30 if private else 24
    conditions, params = [], []
    if not private:
        conditions.append("b.state!='hidden'")
    if state != 'all':
        conditions.append('b.state=?')
        params.append('sealed' if state == 'locked' else state)
    if category:
        conditions.append('b.' + ('draft_type' if private else 'public_type') + '=?')
        params.append(category)
    if query:
        conditions.append('instr(b.' + ('draft_search' if private else 'public_search') + ',?)>0')
        params.append(fold(query))
    if exclude:
        conditions.append('b.id!=?')
        params.append(exclude)
    where = ' AND '.join(conditions) or '1'
    # A single read transaction keeps counts and the selected page consistent.
    total = db.execute('SELECT COUNT(*) FROM browse_index b WHERE '+where, params).fetchone()[0]
    pages = max(1, math.ceil(total/size))
    number = min(max(1, number), pages)
    if private:
        order = 'b.draft_name,e.id' if sort == 'name' else 'e.updated_at DESC,e.id'
        projection = 'e.id,b.name,b.draft_type AS type,b.state,e.revision'
    else:
        order = {'name':'b.public_name,e.id', 'oldest':'e.rowid', 'recent':"(b.state='known') DESC,e.revealed_at DESC,e.rowid"}[sort]
        projection = BRIEF
    rows = db.execute(f'SELECT {projection} FROM entries e JOIN browse_index b ON b.id=e.id WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?', [*params, size, (number-1)*size])
    result = dict(version=1, entries=[dict(row) if private else brief(row) for row in rows], total=total, page=number, pages=pages, pageSize=size)
    if not private:
        result['progress'] = [dict(row) for row in db.execute("SELECT public_type AS category,COUNT(*) AS total,SUM(state='known') AS known FROM browse_index WHERE state!='hidden' GROUP BY public_type")]
        result['recent'] = [brief(row) for row in db.execute(f"SELECT {BRIEF} FROM entries e JOIN browse_index b ON b.id=e.id WHERE b.state='known' AND e.revealed_at IS NOT NULL ORDER BY e.revealed_at DESC,e.id LIMIT 5")]
    return result
