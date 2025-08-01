#!/bin/bash

# Electrical Estimation System - Development Startup Script
echo "🔌 Starting Electrical Estimation System..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update with your configuration."
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p n8n/data
mkdir -p n8n/workflows
mkdir -p n8n/credentials
mkdir -p reports
mkdir -p blueprints
mkdir -p webapp/backend/logs

# Set permissions
chmod +x *.sh

echo "🐳 Starting Docker services..."

# Start database and supporting services
docker-compose up -d postgres redis n8n

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is ready
until docker-compose exec -T postgres psql -U n8n_user -d electrical_estimation -c "SELECT 1" >/dev/null 2>&1; do
    echo "⏳ Still waiting for database..."
    sleep 5
done

echo "✅ Database is ready!"

# Install backend dependencies if needed
if [ ! -d "webapp/backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd webapp/backend
    npm install
    cd ../..
fi

# Install frontend dependencies if needed
if [ ! -d "webapp/frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd webapp/frontend
    npm install
    cd ../..
fi

echo "🚀 Starting application services..."

# Start backend and frontend
docker-compose up -d webapp-backend webapp-frontend

# Wait a moment for services to start
sleep 5

# Show status
echo ""
echo "🎉 Electrical Estimation System is starting up!"
echo ""
echo "📊 Service URLs:"
echo "  • Frontend:        http://localhost:3000"
echo "  • Backend API:     http://localhost:3001"
echo "  • N8N Workflows:   http://localhost:5678"
echo "  • Database:        localhost:5432"
echo "  • Redis:           localhost:6379"
echo ""
echo "🔐 Default Credentials:"
echo "  • N8N:             admin / electrical2024"
echo "  • Database:        n8n_user / electrical_db_pass"
echo ""
echo "🔧 Useful Commands:"
echo "  • View logs:       docker-compose logs -f"
echo "  • Stop system:     docker-compose down"
echo "  • Reset data:      docker-compose down -v"
echo "  • Backend shell:   docker-compose exec webapp-backend sh"
echo "  • Database shell:  docker-compose exec postgres psql -U n8n_user electrical_estimation"
echo ""

# Check service health
echo "🔍 Checking service health..."
sleep 5

# Test backend health
if curl -s http://localhost:3001/health >/dev/null; then
    echo "✅ Backend API is healthy"
else
    echo "⚠️  Backend API may still be starting..."
fi

# Test frontend
if curl -s http://localhost:3000 >/dev/null; then
    echo "✅ Frontend is healthy"
else
    echo "⚠️  Frontend may still be starting..."
fi

# Test N8N
if curl -s http://localhost:5678 >/dev/null; then
    echo "✅ N8N is healthy"
else
    echo "⚠️  N8N may still be starting..."
fi

echo ""
echo "🎯 Quick Start Guide:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Go to /super-agent to access the AI Estimation System"
echo "  3. Click 'Add Project' to create a sample electrical project"
echo "  4. Start the Super Agent system to begin automated estimation"
echo ""
echo "📚 For more information, see README.md"
echo ""

# Open browser if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🌐 Opening browser..."
    sleep 2
    open http://localhost:3000
fi

echo "✨ Setup complete! The system is now running."