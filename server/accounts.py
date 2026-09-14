"""Individual accounts and server-enforced roles."""
import hashlib
import re
import secrets
import sqlite3
import time
import uuid
from flask import abort, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

ROLES = ('mj', 'player', 'guest')


def migrate_accounts(db):
    db.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('mj','player','guest')), active INTEGER NOT NULL DEFAULT 1)")
    if 'user_id' not in [r[1] for r in db.execute('PRAGMA table_info(sessions)')]:
        db.execute('DELETE FROM sessions')
        db.execute('ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id)')
    legacy = db.execute("SELECT value FROM settings WHERE key='password'").fetchone()
    if legacy:
        db.execute("INSERT OR IGNORE INTO users VALUES (?, 'mj', ?, 'mj', 1)", (uuid.uuid4().hex, legacy['value']))
        db.execute("DELETE FROM settings WHERE key='password'")


def current_session(db):
    token = request.cookies.get('outlayer_mj', '')
    return db.execute('SELECT s.*, u.username, u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1',
                      (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone() if token else None


def register_accounts(app, db, private, payload):
    def identity(auth):
        return dict(id=auth['user_id'], username=auth['username'], role=auth['role'])

    def authenticated():
        auth = current_session(db())
        if not auth:
            abort(401, description='Connectez-vous pour continuer.')
        if request.method != 'GET' and not secrets.compare_digest(request.headers.get('X-CSRF-Token', ''), auth['csrf']):
            abort(403, description='Session expirée. Reconnectez-vous.')
        return auth

    @app.post('/api/login')
    def login():
        data = payload()
        username, password = data.get('username', 'mj'), data.get('password', '')
        if not isinstance(username, str) or not isinstance(password, str) or len(username)>40 or len(password)>1024:
            abort(400, description='Identifiants invalides.')
        connection = db()
        connection.execute('BEGIN IMMEDIATE')
        migrate_accounts(connection)
        stamp = time.time()
        key = request.remote_addr or 'local'
        connection.execute('DELETE FROM attempts WHERE expires<?', (stamp,))
        attempt = connection.execute('SELECT * FROM attempts WHERE address=?', (key,)).fetchone()
        if attempt and attempt['count'] >= 8:
            connection.commit()
            abort(429, description='Trop de tentatives. Réessayez dans 15 minutes.')
        user = connection.execute('SELECT * FROM users WHERE username=?', (username.strip(),)).fetchone()
        # A dummy hash also makes unknown usernames pay the password verification cost.
        valid = check_password_hash(user['password'] if user else dummy_hash, password)
        if not user or not valid or not user['active']:
            connection.execute('INSERT INTO attempts VALUES (?, 1, ?) ON CONFLICT(address) DO UPDATE SET count=count+1', (key, stamp+900))
            connection.commit()
            abort(401, description='Identifiant ou mot de passe incorrect.')
        connection.execute('DELETE FROM attempts WHERE address=?', (key,))
        connection.execute('DELETE FROM sessions WHERE expires<?', (stamp,))
        old = request.cookies.get('outlayer_mj', '')
        if old:
            connection.execute('DELETE FROM sessions WHERE token=?', (hashlib.sha256(old.encode()).hexdigest(),))
        raw, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        connection.execute('INSERT INTO sessions (token,csrf,expires,user_id) VALUES (?,?,?,?)', (hashlib.sha256(raw.encode()).hexdigest(), csrf, stamp+8*3600, user['id']))
        connection.commit()
        response = jsonify(csrf=csrf, user=dict(id=user['id'], username=user['username'], role=user['role']))
        response.set_cookie('outlayer_mj', raw, max_age=8*3600, httponly=True, secure=app.config['COOKIE_SECURE'], samesite='Strict')
        return response

    dummy_hash = generate_password_hash(secrets.token_urlsafe(32))

    @app.post('/api/register')
    def register():
        data = payload()
        username = data.get('username')
        if not isinstance(username, str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{2,39}', username) or username.lower() == 'mj':
            abort(400, description='Choisissez un identifiant de 3 à 40 caractères (lettres, chiffres, . _ -).')
        hashed = password_value(data)
        connection = db()
        connection.execute('BEGIN IMMEDIATE')
        key, stamp = 'register:'+(request.remote_addr or 'local'), time.time()
        connection.execute('DELETE FROM attempts WHERE expires<?', (stamp,))
        attempt = connection.execute('SELECT count FROM attempts WHERE address=?', (key,)).fetchone()
        if attempt and attempt['count'] >= 5:
            connection.commit()
            abort(429, description='Trop d’inscriptions. Réessayez dans une heure.')
        connection.execute('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(address) DO UPDATE SET count=count+1', (key,stamp+3600))
        connection.commit()
        try:
            connection.execute("INSERT INTO users VALUES (?,?,?,'guest',1)", (uuid.uuid4().hex,username,hashed))
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            abort(409, description='Cet identifiant est déjà utilisé.')
        return jsonify(ok=True), 201

    @app.get('/api/session')
    def session_info():
        auth = current_session(db())
        return jsonify(user=identity(auth) if auth else None, csrf=auth['csrf'] if auth else None)

    @app.post('/api/logout')
    def logout_account():
        auth = authenticated()
        db().execute('DELETE FROM sessions WHERE token=?', (auth['token'],))
        db().commit()
        response = jsonify(ok=True)
        response.delete_cookie('outlayer_mj')
        return response

    def password_value(data):
        password = data.get('password')
        if not isinstance(password, str) or not 12 <= len(password) <= 1024:
            abort(400, description='Choisissez un mot de passe de 12 à 1 024 caractères.')
        return generate_password_hash(password)

    @app.post('/api/account/password')
    def change_password():
        auth = authenticated()
        data = payload()
        old = data.get('currentPassword')
        row = db().execute('SELECT password FROM users WHERE id=?', (auth['user_id'],)).fetchone()
        if not isinstance(old, str) or len(old)>1024 or not check_password_hash(row['password'], old):
            abort(400, description='Le mot de passe actuel est incorrect.')
        hashed = password_value(data)
        db().execute('UPDATE users SET password=? WHERE id=?', (hashed, auth['user_id']))
        db().execute('DELETE FROM sessions WHERE user_id=?', (auth['user_id'],))
        db().commit()
        response = jsonify(ok=True)
        response.delete_cookie('outlayer_mj')
        return response

    @app.get('/api/admin/users')
    @private
    def list_users():
        try:
            number = max(1, int(request.args.get('page', '1')))
        except ValueError:
            abort(400)
        query = request.args.get('q', '').strip()[:40]
        where = "instr(lower(username),lower(?))>0"
        total = db().execute('SELECT count(*) FROM users WHERE '+where, (query,)).fetchone()[0]
        pages = max(1, (total+19)//20)
        number = min(number, pages)
        rows = db().execute('SELECT id,username,role,active FROM users WHERE '+where+' ORDER BY username LIMIT 20 OFFSET ?', (query, (number-1)*20)).fetchall()
        return jsonify(users=[dict(r) for r in rows], page=number, pages=pages, total=total)

    @app.post('/api/admin/users')
    @private
    def create_user():
        data = payload()
        username, role = data.get('username'), data.get('role')
        if not isinstance(username, str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{2,39}', username) or role not in ROLES:
            abort(400, description='Identifiant : 3 à 40 lettres, chiffres, points, tirets ou underscores. Choisissez un rôle valide.')
        hashed = password_value(data)
        try:
            db().execute('INSERT INTO users VALUES (?,?,?,?,1)', (uuid.uuid4().hex, username, hashed, role))
            db().commit()
        except sqlite3.IntegrityError:
            db().rollback()
            abort(409, description='Cet identifiant est déjà utilisé.')
        return jsonify(ok=True), 201

    @app.put('/api/admin/users/<user_id>')
    @private
    def update_user(user_id):
        data = payload()
        hashed = password_value(data) if 'password' in data else None
        db().execute('BEGIN IMMEDIATE')
        row = db().execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
        if not row:
            abort(404)
        username = data.get('username', row['username'])
        if username != row['username'] and (not isinstance(username, str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{2,39}', username)):
            abort(400, description='Identifiant : 3 à 40 lettres, chiffres, points, tirets ou underscores.')
        role, active = data.get('role', row['role']), data.get('active', bool(row['active']))
        if role not in ROLES or not isinstance(active, bool):
            abort(400, description='Rôle ou état invalide.')
        if row['role']=='mj' and row['active'] and (role!='mj' or not active):
            if db().execute("SELECT count(*) FROM users WHERE role='mj' AND active=1").fetchone()[0] <= 1:
                abort(409, description='Conservez au moins un compte MJ actif.')
        try:
            db().execute('UPDATE users SET username=?,role=?,active=?,password=? WHERE id=?', (username, role, int(active), hashed or row['password'], user_id))
        except sqlite3.IntegrityError:
            db().rollback()
            abort(409, description='Cet identifiant est déjà utilisé.')
        revoked = role != row['role'] or active != bool(row['active']) or hashed is not None
        if revoked:
            db().execute('DELETE FROM sessions WHERE user_id=?', (user_id,))
        db().commit()
        return jsonify(ok=True, sessionsRevoked=revoked)
