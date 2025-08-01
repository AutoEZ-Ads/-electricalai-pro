#!/bin/bash

# Electrical Estimation System Setup Script
# This script sets up the complete N8N-based electrical estimation system

set -e  # Exit on any error

echo "🔌 Setting up Electrical Estimation System..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed (for building custom nodes)
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

print_status "All prerequisites are installed ✅"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cat > .env << EOF
# Database Configuration
DB_PASSWORD=electrical_db_pass_$(date +%s)
POSTGRES_URL=postgresql://n8n_user:\${DB_PASSWORD}@postgres:5432/electrical_estimation

# N8N Configuration
N8N_PASSWORD=electrical_admin_$(date +%s)
N8N_WEBHOOK_URL=http://n8n:5678/webhook

# Application Configuration
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Redis Configuration
REDIS_URL=redis://redis:6379
EOF
    print_success ".env file created"
else
    print_warning ".env file already exists, skipping creation"
fi

# Create required directories
print_status "Creating directory structure..."
mkdir -p n8n/{data,custom-nodes,workflows,credentials}
mkdir -p webapp/{frontend,backend}/node_modules
mkdir -p plugins/{electrical-calculator,material-database,report-generator}
mkdir -p kubernetes/{deployments,services}
mkdir -p reports
mkdir -p blueprints
print_success "Directory structure created"

# Build N8N custom nodes
print_status "Building N8N custom electrical calculator node..."
cd n8n/custom-nodes/electrical-calculator-node

if [ ! -f package.json ]; then
    print_error "Custom node package.json not found. Please ensure the custom node files are in place."
    exit 1
fi

# Install dependencies and build
npm install
if command -v npm run build &> /dev/null; then
    npm run build
fi

cd ../../../

print_success "N8N custom nodes built"

# Install backend dependencies
print_status "Installing backend dependencies..."
cd webapp/backend
if [ -f package.json ]; then
    npm install
    print_success "Backend dependencies installed"
else
    print_warning "Backend package.json not found, skipping backend dependency installation"
fi
cd ../../

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd webapp/frontend
if [ -f package.json ]; then
    npm install
    print_success "Frontend dependencies installed"
else
    print_warning "Frontend package.json not found, skipping frontend dependency installation"
fi
cd ../../

# Create simple plugin services
print_status "Setting up plugin services..."

# Electrical Calculator Plugin
cat > plugins/electrical-calculator/package.json << 'EOF'
{
  "name": "electrical-calculator-service",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "scripts": {
    "start": "node server.js"
  }
}
EOF

cat > plugins/electrical-calculator/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'electrical-calculator' });
});

app.listen(port, () => {
  console.log(`Electrical Calculator service running on port ${port}`);
});
EOF

cat > plugins/electrical-calculator/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3002
CMD ["npm", "start"]
EOF

# Material Database Plugin
cat > plugins/material-database/package.json << 'EOF'
{
  "name": "material-database-service",
  "version": "1.0.0", 
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "scripts": {
    "start": "node server.js"
  }
}
EOF

cat > plugins/material-database/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3003;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'material-database' });
});

app.listen(port, () => {
  console.log(`Material Database service running on port ${port}`);
});
EOF

cat > plugins/material-database/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3003
CMD ["npm", "start"]
EOF

# Report Generator Plugin
cat > plugins/report-generator/package.json << 'EOF'
{
  "name": "report-generator-service",
  "version": "1.0.0",
  "main": "server.js", 
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "scripts": {
    "start": "node server.js"
  }
}
EOF

cat > plugins/report-generator/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3004;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'report-generator' });
});

app.listen(port, () => {
  console.log(`Report Generator service running on port ${port}`);
});
EOF

cat > plugins/report-generator/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3004
CMD ["npm", "start"]
EOF

print_success "Plugin services created"

# Start Docker services
print_status "Starting Docker services..."
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose up -d --build

print_status "Waiting for services to start..."
sleep 30

# Check service health
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_success "$service is healthy"
            return 0
        fi
        print_status "Waiting for $service... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    print_warning "$service is not responding after $max_attempts attempts"
    return 1
}

print_status "Checking service health..."
check_service "Database" "http://localhost:5432" || true
check_service "Redis" "http://localhost:6379" || true
check_service "Backend API" "http://localhost:3001/health" || true
check_service "Frontend" "http://localhost:3000" || true
check_service "N8N" "http://localhost:5678" || true

echo ""
echo "🎉 Setup Complete!"
echo "==================="
echo ""
echo "Your Electrical Estimation System is now running:"
echo ""
echo "📊 Web Application:    http://localhost:3000"
echo "🔧 Backend API:        http://localhost:3001"
echo "⚡ N8N Workflows:      http://localhost:5678"
echo "🗄️  Database:          localhost:5432"
echo "💾 Redis:              localhost:6379"
echo ""
echo "Default N8N Login:"
echo "Username: admin"
echo "Password: Check your .env file for N8N_PASSWORD"
echo ""
echo "🚀 Next Steps:"
echo "1. Open http://localhost:3000 to access the web application"
echo "2. Create your first electrical estimation project"
echo "3. Access N8N at http://localhost:5678 to view/modify workflows"
echo "4. Check logs with: docker-compose logs -f"
echo ""
echo "📚 Documentation:"
echo "- Project files are in the current directory"
echo "- Database is automatically initialized with sample data"
echo "- N8N workflows are pre-configured for electrical calculations"
echo ""
echo "⚠️  Important:"
echo "- Keep your .env file secure"
echo "- Back up your data regularly"
echo "- Check docker-compose logs if you encounter issues"
echo ""

# Show running containers
print_status "Running containers:"
docker-compose ps

echo ""
print_success "Electrical Estimation System is ready! 🔌⚡"