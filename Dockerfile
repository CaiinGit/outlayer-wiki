FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --uid 10001 --create-home outlayer \
    && mkdir /data /backups && chown outlayer:outlayer /data /backups
COPY server ./server
COPY data ./data
COPY assets ./assets
COPY admin ./admin
COPY journal ./journal
COPY timeline ./timeline
COPY index.html app.js catalog.js entry-view.js styles.css ./
USER outlayer
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 OUTLAYER_DB=/data/outlayer.sqlite
EXPOSE 8000
CMD ["python", "-m", "server.run"]
