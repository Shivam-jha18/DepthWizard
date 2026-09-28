# Multi-stage build for Standalone DepthWizard Deployment
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend-react/package*.json ./
RUN npm ci --silent
COPY frontend-react/ ./
RUN npm run build

# Python Backend & Final Runtime
FROM python:3.9-slim-bullseye
WORKDIR /app

# Install system dependencies for OpenCV and geospatial tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt h5py

# Copy application source code
COPY backend/ ./backend/
COPY src/ ./src/
COPY models/ ./models/
COPY data/ ./data/

# Copy built frontend assets to serve locally
COPY --from=frontend-builder /app/frontend/build ./frontend-build

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV OFFLINE_MODE=1

CMD ["python", "backend/main.py"]
