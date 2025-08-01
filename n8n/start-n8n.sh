#!/bin/bash

# 🚀 N8N Quick Start Script for ElectricalAI Pro
# One-command setup for local development

set -euo pipefail

echo "🚀 Starting N8N for ElectricalAI Pro..."
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
N8N_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.n8n.yml"

# Check prerequisites
echo -e "${BLUE}[INFO]${NC} Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}[WARNING]${NC} Docker is not installed. Please install Docker Desktop first."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${YELLOW}[WARNING]${NC} Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f "$N8N_DIR/.env" ]; then
    echo -e "${BLUE}[INFO]${NC} Creating environment configuration..."
    cp "$N8N_DIR/.env.n8n" "$N8N_DIR/.env"
    
    # Generate secure passwords
    N8N_DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    N8N_BASIC_AUTH_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    # Update .env with generated values
    sed -i.bak "s/n8n_secure_password/$N8N_DB_PASSWORD/g" "$N8N_DIR/.env"
    sed -i.bak "s/electricalai_admin/$N8N_BASIC_AUTH_PASSWORD/g" "$N8N_DIR/.env"
    sed -i.bak "s/your-32-character-encryption-key/$N8N_ENCRYPTION_KEY/g" "$N8N_DIR/.env"
    
    echo -e "${GREEN}[SUCCESS]${NC} Environment configured with secure passwords"
fi

# Stop any existing N8N containers
echo -e "${BLUE}[INFO]${NC} Stopping any existing N8N containers..."
cd "$N8N_DIR"
docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

# Create required directories
echo -e "${BLUE}[INFO]${NC} Creating required directories..."
mkdir -p workflows custom-nodes credentials data

# Start N8N services
echo -e "${BLUE}[INFO]${NC} Starting N8N services..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be ready
echo -e "${BLUE}[INFO]${NC} Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    echo -e "${GREEN}[SUCCESS]${NC} N8N services started successfully!"
    
    # Get credentials from .env
    N8N_USER=$(grep N8N_BASIC_AUTH_USER .env | cut -d '=' -f2)
    N8N_PASS=$(grep N8N_BASIC_AUTH_PASSWORD .env | cut -d '=' -f2)
    
    echo ""
    echo "🎉 N8N is now running!"
    echo "======================"
    echo "🌐 URL: http://localhost:5678"
    echo "👤 Username: $N8N_USER"
    echo "🔑 Password: $N8N_PASS"
    echo ""
    echo "📊 Services Status:"
    docker-compose -f $COMPOSE_FILE ps
    echo ""
    echo "📋 Next Steps:"
    echo "1. Open http://localhost:5678 in your browser"
    echo "2. Log in with the credentials above"
    echo "3. Import ElectricalAI Pro workflows"
    echo "4. Configure integrations with your API keys"
    echo ""
    echo "🔧 Useful Commands:"
    echo "- View logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "- Stop N8N: docker-compose -f $COMPOSE_FILE down"
    echo "- Restart N8N: docker-compose -f $COMPOSE_FILE restart"
    echo ""
else
    echo -e "${YELLOW}[WARNING]${NC} Services may not have started correctly. Check logs:"
    echo "docker-compose -f $COMPOSE_FILE logs"
fi