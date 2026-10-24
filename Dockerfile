FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MPLBACKEND=Agg HOST=0.0.0.0 PORT=8000
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY . .
COPY --from=frontend /build/dist ./frontend/dist
RUN mkdir -p /app/data/workspace && useradd --create-home retail && chown -R retail:retail /app
USER retail
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
CMD ["python", "app.py"]
