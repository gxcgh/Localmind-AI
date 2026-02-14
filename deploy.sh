#!/bin/bash

# LocalMind AI Deployment Script

echo "🚀 Starting LocalMind AI Deployment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found! Copying from .env.example..."
    cp .env.example .env
    echo "PLEASE UPDATE .env WITH YOUR GEMINI_API_KEY"
fi

# Build and Run Backend via Docker Compose
echo "🐳 Building and Starting Backend..."
docker compose up --build -d

echo "✅ Backend deployed on port 8000"
echo "   - Health Check: http://localhost:8000/health"
echo "   - API Endpoint: http://localhost:8000/analyze"

# Frontend Deployment Instructions (since access to physical device is needed for Expo)
echo "📱 Frontend Setup:"
echo "   1. cd frontend"
echo "   2. npm install"
echo "   3. npm start"
echo "   Scan the QR code with Expo Go app."

echo "🎉 Deployment Complete!"
