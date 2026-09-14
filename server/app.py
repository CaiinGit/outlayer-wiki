import io
import json
import os
import re
import secrets
import uuid
import warnings
from functools import wraps
from pathlib import Path

from flask import Flask, abort, g, jsonify, request, send_file, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError

from .store import ROOT, TYPES, connect, initialize, now, public_item
from .browse import index_entry, page, related
from .teasers import make_teaser
from .accounts import current_session, register_accounts
from .journal import register_journal
from .timeline import register_timeline

Image.MAX_IMAGE_PIXELS = 20_000_000


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.json.ensure_ascii = False
    app.config.update(DB_PATH=os.environ.get('OUTLAYER_DB', '/data/outlayer.sqlite'),
                      MAX_CONTENT_LENGTH=10 * 1024 * 1024,
                      COOKIE_SECURE=os.environ.get('COOKIE_SECURE', '0') == '1',
                      ORIGIN=os.environ.get('APP_ORIGIN', 'http://192.168.1.197:8081').rstrip('/'))
    if config:
        app.config.update(config)
    initialize(app.config['DB_PATH'])

    def db():
        if 'db' not in g:
            g.db = connect(app.config['DB_PATH'])
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        if 'db' in g:
            g.db.close()

    def session():
        return current_session(db())

    def private(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            g.auth = session()
            if not g.auth:
                abort(401, description='Connexion MJ requise.')
            if g.auth['role'] != 'mj':
                abort(403, description='Cet espace est réservé au MJ.')
            if request.method not in ('GET', 'HEAD') and not secrets.compare_digest(request.headers.get('X-CSRF-Token', ''), g.auth['csrf']):
                abort(403, description='Session expirée. Reconnectez-vous.')
            return fn(*args, **kwargs)
        return wrapped

    @app.before_request
    def protect_origin():
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and request.headers.get('Origin') != app.config['ORIGIN']:
            abort(403, description='Origine de la requête refusée.')

    @app.before_request
    def protect_codex():
        path = request.path
        if path in ('/api/catalog', '/data/codex.json', '/api/journal', '/api/timeline') or path.startswith(('/api/entries/', '/api/images/', '/api/teasers/', '/assets/codex/', '/api/journal/', '/api/timeline/')):
            auth = session()
            if not auth:
                abort(401, description='Connectez-vous pour consulter la campagne.')
            if auth['role'] not in ('mj', 'player'):
                abort(403, description='Votre compte invité attend la validation du MJ.')

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['Referrer-Policy'] = 'same-origin'
        return response

    @app.errorhandler(400)
    @app.errorhandler(401)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(409)
    @app.errorhandler(413)
    @app.errorhandler(429)
    @app.errorhandler(503)
    def error(exc):
        return jsonify(error=exc.description), exc.code

    def payload():
        value = request.get_json(silent=True)
        if not isinstance(value, dict):
            abort(400, description='Données invalides.')
        return value

    def get_entry(entry_id):
        row = db().execute('SELECT * FROM entries WHERE id=?', (entry_id,)).fetchone()
        if row is None:
            abort(404)
        return row

    def serialize(row):
        published = json.loads(row['published']) if row['published'] else None
        return dict(id=row['id'], draft=json.loads(row['draft']), revision=row['revision'],
                    state='known' if published and published['known'] else 'sealed' if published else 'hidden',
                    published=published, revealedAt=row['revealed_at'], updatedAt=row['updated_at'],
                    relationLabels=related(db(), json.loads(row['draft']).get('relations', []), private=True))

    def validate(value, entry_id):
        data = {}
        for field, limit in dict(type=30, name=160, description=20000, subtitle=200, teaser=500, symbol=8, notes=30000).items():
            text = value.get(field, '')
            if not isinstance(text, str) or len(text) > limit:
                abort(400, description=f'Champ invalide ou trop long : {field}.')
            data[field] = text.strip()
        if data['type'] not in TYPES or not data['name']:
            abort(400, description='Le nom et le type sont obligatoires.')
        for field, limit, length in [('details', 50, 4000), ('tags', 30, 60), ('relations', 50, 80)]:
            values = value.get(field, [])
            if not isinstance(values, list) or len(values) > limit or any(not isinstance(v, str) or len(v) > length for v in values):
                abort(400, description=f'Liste invalide : {field}.')
            data[field] = list(dict.fromkeys(v.strip() for v in values if v.strip()))
        for target in data['relations']:
            if target == entry_id or not db().execute('SELECT 1 FROM entries WHERE id=?', (target,)).fetchone():
                abort(400, description='Lien vers une archive invalide.')
        image = value.get('image')
        if image is not None:
            if not isinstance(image, str):
                abort(400, description='Image invalide.')
            upload = re.fullmatch(r'/api/images/([a-f0-9]{32})', image)
            local = re.fullmatch(r'assets/codex/[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg|avif|svg)', image)
            if not ((upload and db().execute('SELECT 1 FROM images WHERE id=?', (upload[1],)).fetchone()) or (local and (ROOT / image).is_file())):
                abort(400, description='Image inconnue. Importez une image depuis le formulaire.')
        data['image'] = image
        return data

    @app.get('/health')
    def health():
        db().execute('SELECT 1').fetchone()
        return jsonify(ok=True)

    @app.get('/api/catalog')
    @app.get('/data/codex.json')
    def public_catalog():
        return browse()

    def browse(private=False, lookup=False):
        try:
            number = int(request.args.get('page', '1'))
        except ValueError:
            abort(400, description='Numéro de page invalide.')
        category = request.args.get('type', '')
        state = request.args.get('state', 'all')
        sort = request.args.get('sort', 'recent')
        query = request.args.get('q', '').strip()
        if category and category not in TYPES or state not in (('all','known','sealed','hidden') if private else ('all','known','locked')) or sort not in (('recent','name') if private else ('recent','name','oldest')) or len(query)>200:
            abort(400, description='Filtres invalides.')
        db().execute('BEGIN')
        return jsonify(page(db(), number=number, query=query, category=category, state=state, sort=sort,
                            private=private, lookup=lookup, exclude=request.args.get('exclude','') if lookup else ''))

    def detail(row, preview=False):
        item = public_item(row['id'], json.loads(row['draft'])) if preview else json.loads(row['published']) if row['published'] else None
        if not item or not item['known']:
            abort(404, description='Cette archive n’est plus disponible.')
        links = related(db(), [i for i in item.get('relations', []) if i != row['id']])
        item['relations'] = [e['id'] for e in links]
        item['revealedAt'] = row['revealed_at']
        return jsonify(entry=item, related=links)

    @app.get('/api/entries/<entry_id>')
    def public_detail(entry_id):
        db().execute('BEGIN')
        row = db().execute('SELECT id,published,revealed_at FROM entries WHERE id=?', (entry_id,)).fetchone()
        if not row:
            abort(404)
        return detail(row)

    register_accounts(app, db, private, payload)
    register_journal(app, db, private, payload)
    register_timeline(app, db, private, payload)

    @app.get('/api/admin/session')
    @private
    def me():
        return jsonify(csrf=g.auth['csrf'], types=TYPES)

    @app.post('/api/admin/logout')
    @private
    def logout():
        db().execute('DELETE FROM sessions WHERE token=?', (g.auth['token'],))
        db().commit()
        response = jsonify(ok=True)
        response.delete_cookie('outlayer_mj')
        return response

    @app.get('/api/admin/entries')
    @private
    def entries():
        return browse(private=True)

    @app.get('/api/admin/lookup')
    @private
    def lookup():
        return browse(private=True, lookup=True)

    @app.get('/api/admin/entries/<entry_id>')
    @private
    def admin_detail(entry_id):
        db().execute('BEGIN')
        return jsonify(serialize(get_entry(entry_id)))

    @app.post('/api/admin/entries')
    @private
    def create():
        data = payload()
        entry_id = uuid.uuid4().hex
        draft = validate(data, entry_id)
        db().execute('INSERT INTO entries VALUES (?, ?, NULL, 1, NULL, ?)', (entry_id, json.dumps(draft, ensure_ascii=False), now()))
        index_entry(db(), entry_id)
        db().commit()
        return jsonify(serialize(get_entry(entry_id))), 201

    @app.put('/api/admin/entries/<entry_id>')
    @private
    def save(entry_id):
        data = payload()
        draft = validate(data, entry_id)
        cursor = db().execute('UPDATE entries SET draft=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?',
                              (json.dumps(draft, ensure_ascii=False), now(), entry_id, data.get('revision')))
        if cursor.rowcount != 1:
            db().rollback()
            abort(409, description='Cette fiche a changé dans un autre onglet. Rechargez la liste avant de modifier à nouveau.')
        index_entry(db(), entry_id)
        db().commit()
        return jsonify(serialize(get_entry(entry_id)))

    @app.post('/api/admin/entries/<entry_id>/<action>')
    @private
    def publish(entry_id, action):
        if action not in ('publish', 'seal', 'hide'):
            abort(404)
        data = payload()
        db().execute('BEGIN IMMEDIATE')
        row = get_entry(entry_id)
        if data.get('revision') != row['revision']:
            abort(409, description='Cette fiche a changé. Rechargez la liste.')
        draft = json.loads(row['draft'])
        if action == 'publish' and draft['name'] == '???':
            abort(400, description='Donnez un nom à la fiche avant de la révéler.')
        publication = public_item(entry_id, draft, action == 'publish') if action != 'hide' else None
        if action == 'seal':
            publication['image'] = make_teaser(db(), draft.get('image'))
        previous = json.loads(row['published']) if row['published'] else None
        revealed = row['revealed_at']
        if action == 'publish' and not (previous and previous['known']):
            revealed = now()
        db().execute('UPDATE entries SET published=?, revealed_at=?, revision=revision+1, updated_at=? WHERE id=?',
                     (json.dumps(publication, ensure_ascii=False) if publication else None, revealed, now(), entry_id))
        index_entry(db(), entry_id)
        db().commit()
        return jsonify(serialize(get_entry(entry_id)))

    @app.get('/api/admin/preview/<entry_id>')
    @private
    def preview(entry_id):
        db().execute('BEGIN')
        return detail(get_entry(entry_id), preview=True)

    @app.post('/api/admin/images')
    @private
    def upload():
        file = request.files.get('image')
        if not file:
            abort(400, description='Choisissez une image PNG, JPEG ou WebP.')
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(file.stream) as original:
                    if original.format not in ('PNG', 'JPEG', 'WEBP'):
                        abort(400, description='Format accepté : PNG, JPEG ou WebP.')
                    image = ImageOps.exif_transpose(original).convert('RGBA')
                    image.thumbnail((1600, 1000))
                    output = io.BytesIO()
                    image.save(output, 'WEBP', quality=85, method=4)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            abort(400, description='Image invalide ou trop grande (20 millions de pixels maximum).')
        image_id = uuid.uuid4().hex
        db().execute('INSERT INTO images VALUES (?, ?)', (image_id, output.getvalue()))
        db().commit()
        return jsonify(image='/api/images/'+image_id)

    @app.get('/api/images/<image_id>')
    def image(image_id):
        path = '/api/images/'+image_id
        if session()['role'] != 'mj' and not db().execute("SELECT 1 FROM entries WHERE json_extract(published, '$.known')=1 AND json_extract(published, '$.image')=? LIMIT 1", (path,)).fetchone():
            abort(404)
        row = db().execute('SELECT body FROM images WHERE id=?', (image_id,)).fetchone()
        if not row:
            abort(404)
        return send_file(io.BytesIO(row['body']), mimetype='image/webp', max_age=0)

    @app.get('/api/teasers/<image_id>')
    def teaser_image(image_id):
        # Even a guessed original ID cannot be downloaded through this endpoint.
        path = '/api/teasers/'+image_id
        if not db().execute("SELECT 1 FROM entries WHERE json_extract(published, '$.known')=0 AND json_extract(published, '$.image')=? LIMIT 1", (path,)).fetchone():
            abort(404)
        row = db().execute('SELECT body FROM images WHERE id=?', (image_id,)).fetchone()
        if not row:
            abort(404)
        return send_file(io.BytesIO(row['body']), mimetype='image/webp', max_age=0)

    # Local preview and production use the same explicit public file allowlist.
    @app.get('/')
    def home():
        return send_from_directory(ROOT, 'index.html')

    @app.get('/admin/')
    def admin():
        return send_from_directory(ROOT / 'admin', 'index.html')

    @app.get('/account/')
    def account_page():
        return send_from_directory(ROOT / 'admin', 'account.html')

    @app.get('/sessions/')
    def sessions_page():
        return send_from_directory(ROOT / 'journal', 'index.html')

    @app.get('/chronologie/')
    def chronology_page():
        return send_from_directory(ROOT / 'timeline','index.html')

    @app.get('/<path:name>')
    def static_file(name):
        if name in ('timeline/timeline.css','timeline/public.js','timeline/common.js','admin/timeline.html','admin/timeline.js'):
            return send_from_directory(ROOT,name)
        if name in ('journal/journal.css','journal/public.js','admin/journal.html','admin/journal.js'):
            return send_from_directory(ROOT,name)
        if name in ('styles.css', 'app.js', 'catalog.js', 'entry-view.js', 'admin/admin.js', 'admin/admin.css', 'admin/account.html', 'admin/account.js', 'admin/users.html', 'admin/users.js') or (name.startswith('assets/') and '..' not in Path(name).parts):
            return send_from_directory(ROOT, name)
        abort(404)

    return app
