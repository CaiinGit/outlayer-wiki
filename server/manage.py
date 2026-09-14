import argparse
import getpass
import os
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from werkzeug.security import generate_password_hash
from .store import connect, initialize


def backup(database, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / ('outlayer-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
    temporary = target.with_suffix('.tmp')
    source = connect(database)
    destination = sqlite3.connect(temporary)
    try:
        source.backup(destination)
        if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Sauvegarde invalide')
    finally:
        destination.close()
        source.close()
    os.replace(temporary, target)
    if os.name != 'nt':
        os.chmod(target, 0o600)
    for old in sorted(directory.glob('outlayer-*.sqlite'))[:-14]:
        old.unlink()
    return target


def restore(database, source, directory):
    source = Path(source).resolve()
    if source.parent != Path(directory).resolve() or source.suffix != '.sqlite' or not source.is_file():
        raise ValueError('Choisir une sauvegarde dans le répertoire prévu')
    db = sqlite3.connect(f'file:{source.as_posix()}?mode=ro', uri=True)
    try:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA user_version').fetchone()[0] not in (1, 2, 3, 4, 5):
            raise ValueError('Sauvegarde invalide')
        for table in ['entries', 'settings', 'images', 'sessions']:
            db.execute(f'SELECT 1 FROM {table} LIMIT 1')
        # Read the selected backup before retention can remove it.
        temporary = Path(database).with_suffix('.restore')
        dest = sqlite3.connect(temporary)
        try:
            db.backup(dest)
            dest.execute('DELETE FROM sessions')
            dest.execute('DELETE FROM attempts')
            dest.commit()
        finally:
            dest.close()
    finally:
        db.close()
    if Path(database).exists():
        backup(database, directory)
    # API and backup services must be stopped before this offline operation.
    for suffix in ('-wal', '-shm'):
        Path(str(database)+suffix).unlink(missing_ok=True)
    os.replace(temporary, database)
    if os.name != 'nt':
        os.chmod(database, 0o600)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['set-password', 'backup', 'backup-loop', 'restore'])
    parser.add_argument('filename', nargs='?')
    parser.add_argument('--confirm-services-stopped', action='store_true')
    args = parser.parse_args()
    database = os.environ.get('OUTLAYER_DB', '/data/outlayer.sqlite')
    directory = os.environ.get('BACKUP_DIR', '/backups')
    if args.command == 'set-password':
        password = getpass.getpass('Nouveau mot de passe MJ (12 caractères minimum) : ')
        if len(password) < 12 or len(password) > 1024 or password != getpass.getpass('Confirmez le mot de passe : '):
            raise SystemExit('Mot de passe trop court ou confirmation différente.')
        initialize(database)
        with connect(database) as db:
            db.execute("INSERT INTO users VALUES (?, 'mj', ?, 'mj', 1) ON CONFLICT(username) DO UPDATE SET password=excluded.password,role='mj',active=1", (uuid.uuid4().hex, generate_password_hash(password)))
            db.execute('DELETE FROM sessions')
            db.execute('DELETE FROM attempts')
        print('Mot de passe enregistré. Les anciennes sessions sont fermées.')
    elif args.command == 'restore':
        if not args.filename or not args.confirm_services_stopped:
            raise SystemExit('Arrêtez api et backup, puis indiquez le fichier et --confirm-services-stopped.')
        restore(database, Path(directory) / args.filename, directory)
        print('Restauration terminée. Redémarrez api et backup.')
    elif args.command == 'backup':
        if not Path(database).is_file():
            raise SystemExit('La base n’existe pas encore.')
        print(backup(database, directory).name)
    else:
        while True:
            try:
                if not Path(database).is_file():
                    time.sleep(10)
                    continue
                print('Sauvegarde :', backup(database, directory).name, flush=True)
            except Exception as error:
                print('Échec de sauvegarde :', error, flush=True)
                time.sleep(60)
                continue
            time.sleep(86400)


if __name__ == '__main__':
    main()
