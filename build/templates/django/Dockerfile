# Django + gunicorn (8080)
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

COPY . .

EXPOSE 8080
# wsgi.py 가 있는 디렉토리를 자동 감지하여 gunicorn 실행
CMD ["sh", "-c", "WSGI_DIR=$(find . -maxdepth 2 -name wsgi.py | head -1 | xargs dirname | xargs basename) && \
                  python manage.py migrate --noinput || true && \
                  gunicorn ${WSGI_DIR}.wsgi:application --bind 0.0.0.0:8080 --workers 2"]
