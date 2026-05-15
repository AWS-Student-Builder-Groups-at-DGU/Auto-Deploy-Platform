# Flask + gunicorn (8080)
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

COPY . .

EXPOSE 8080
# 일반적인 진입점들 자동 탐지: app.py / main.py / wsgi.py
CMD ["sh", "-c", "if [ -f app.py ]; then \
                      gunicorn app:app --bind 0.0.0.0:8080 --workers 2; \
                  elif [ -f main.py ]; then \
                      gunicorn main:app --bind 0.0.0.0:8080 --workers 2; \
                  elif [ -f wsgi.py ]; then \
                      gunicorn wsgi:app --bind 0.0.0.0:8080 --workers 2; \
                  else \
                      echo 'No entry point found (app.py / main.py / wsgi.py required)' && exit 1; \
                  fi"]
