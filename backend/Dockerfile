FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .
RUN useradd -m artofsoul && mkdir -p /app/data/storage && chown -R artofsoul /app/data
USER artofsoul
EXPOSE 8040
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8040/api/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8040", "--proxy-headers"]
