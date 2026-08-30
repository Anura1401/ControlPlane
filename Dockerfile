# Production-grade Python image
FROM python:3.10-slim

# System updates and build prerequisites for FAISS
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Work directory
WORKDIR /workspace

# Install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source directories
COPY app/ app/
COPY policies/ policies/
COPY training/ training/
COPY scripts/ scripts/
COPY models/ models/

# Expose port
EXPOSE 8000

# Set environment defaults (can be overridden)
ENV MOCK_ML=true
ENV PORT=8000
ENV HOST=0.0.0.0

# Start API service
CMD ["python", "-m", "app.main"]
