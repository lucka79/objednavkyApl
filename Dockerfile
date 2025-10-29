FROM python:3.11-slim

# Install system dependencies in one layer for better caching
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-ces \
    tesseract-ocr-eng \
    poppler-utils \
    libzbar0 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy requirements first for better Docker layer caching
COPY python-ocr-service/requirements.txt .

# Install Python dependencies with cache optimization
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code (this layer will change most often)
COPY python-ocr-service/main.py start.sh .

# Make startup script executable
RUN chmod +x start.sh

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Create entrypoint script
RUN echo '#!/bin/bash\nexec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Run the application
ENTRYPOINT ["/app/entrypoint.sh"]
