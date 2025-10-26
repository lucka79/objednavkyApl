#!/bin/bash
# Start the FastAPI application with uvicorn
# Use Railway's PORT environment variable, or default to 8000
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

