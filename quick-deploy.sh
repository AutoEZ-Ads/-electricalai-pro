#!/bin/bash

# Quick Cloud-Based Deployment Script
# Uses Google Cloud Build for complete deployment without local dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

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

print_header() {
    echo -e "${PURPLE}$1${NC}"
    echo "$(printf '=%.0s' {1..60})"
}

print_header "⚡ ELECTRICAL ESTIMATION SYSTEM - QUICK DEPLOY"
echo "Cloud-native deployment using Google Cloud Build"
echo ""

# Check if we have gcloud available
if command -v gcloud &> /dev/null; then
    GCLOUD="gcloud"
elif [[ -x "/usr/local/bin/gcloud" ]]; then
    GCLOUD="/usr/local/bin/gcloud"
elif [[ -x "/opt/homebrew/bin/gcloud" ]]; then
    GCLOUD="/opt/homebrew/bin/gcloud"
else
    print_error "Google Cloud SDK not found. Please install it first:"
    echo "  curl https://sdk.cloud.google.com | bash"
    exit 1
fi

# Get current project
PROJECT_ID=$($GCLOUD config get-value project 2>/dev/null)

if [[ -z "$PROJECT_ID" ]]; then
    print_status "No project configured. Listing available projects:"
    $GCLOUD projects list --format="table(projectId,name)" 2>/dev/null || {
        print_error "Please authenticate first: $GCLOUD auth login"
        exit 1
    }
    
    echo ""
    read -p "Enter your GCP Project ID: " PROJECT_ID
    $GCLOUD config set project "$PROJECT_ID"
fi

print_success "Using project: $PROJECT_ID"

# Enable required APIs
print_status "Enabling required APIs..."
$GCLOUD services enable cloudbuild.googleapis.com --quiet
$GCLOUD services enable container.googleapis.com --quiet
$GCLOUD services enable secretmanager.googleapis.com --quiet

# Create secrets for the build
print_status "Creating build secrets..."

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
N8N_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)
N8N_ENCRYPTION_KEY=$(openssl rand -hex 16)

# Create secrets in Secret Manager
echo "$DB_PASSWORD" | $GCLOUD secrets create db-password --data-file=- --quiet 2>/dev/null || {
    echo "$DB_PASSWORD" | $GCLOUD secrets versions add db-password --data-file=- --quiet
}

echo "$N8N_PASSWORD" | $GCLOUD secrets create n8n-password --data-file=- --quiet 2>/dev/null || {
    echo "$N8N_PASSWORD" | $GCLOUD secrets versions add n8n-password --data-file=- --quiet
}

echo "$N8N_ENCRYPTION_KEY" | $GCLOUD secrets create n8n-encryption-key --data-file=- --quiet 2>/dev/null || {
    echo "$N8N_ENCRYPTION_KEY" | $GCLOUD secrets versions add n8n-encryption-key --data-file=- --quiet
}

print_success "Secrets created in Secret Manager"

# Create terraform.tfvars for the build
mkdir -p gcp/terraform/environments/dev

# Get domain and email from user
read -p "Enter your domain name (e.g., mycompany.com): " DOMAIN_NAME
read -p "Enter notification email: " NOTIFICATION_EMAIL

cat > gcp/terraform/environments/dev/terraform.tfvars << EOF
# GCP Project Configuration
project_id = "$PROJECT_ID"
region     = "us-central1"
zone       = "us-central1-a"

# Environment
environment = "dev"

# Domain Configuration
domain_name = "$DOMAIN_NAME"

# Network Configuration
subnet_cidr   = "10.0.0.0/24"
pods_cidr     = "10.1.0.0/16"
services_cidr = "10.2.0.0/16"

# Database Configuration
db_tier         = "db-f1-micro"
db_disk_size    = 20
db_max_disk_size = 100
db_user         = "n8n_user"

# GKE Configuration
gke_cluster_name = "electrical-estimation-dev"

# Cloud Run Configuration
cloud_run_min_instances = 0
cloud_run_max_instances = 10
cloud_run_cpu          = "1000m"
cloud_run_memory       = "2Gi"

# Monitoring Configuration
enable_monitoring   = true
notification_email  = "$NOTIFICATION_EMAIL"
EOF

print_success "Configuration created"

# Create the Docker files for services
print_status "Preparing container definitions..."

# Create material database service
mkdir -p plugins/material-database

cat > plugins/material-database/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

CMD ["node", "server.js"]
EOF

cat > plugins/material-database/package.json << 'EOF'
{
  "name": "material-database",
  "version": "1.0.0",
  "description": "Electrical materials pricing database service",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "redis": "^4.6.7",
    "pg": "^8.11.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

cat > plugins/material-database/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Sample material pricing data
const MATERIAL_PRICES = {
  "copper_wire_12awg": { price: 2.50, unit: "per_foot", updated: "2024-01-01" },
  "copper_wire_10awg": { price: 3.75, unit: "per_foot", updated: "2024-01-01" },
  "copper_wire_8awg": { price: 5.25, unit: "per_foot", updated: "2024-01-01" },
  "electrical_outlet_15a": { price: 12.50, unit: "each", updated: "2024-01-01" },
  "electrical_switch_15a": { price: 8.75, unit: "each", updated: "2024-01-01" },
  "electrical_panel_200a": { price: 450.00, unit: "each", updated: "2024-01-01" },
  "conduit_emt_1_2": { price: 3.25, unit: "per_10ft", updated: "2024-01-01" },
  "conduit_emt_3_4": { price: 4.50, unit: "per_10ft", updated: "2024-01-01" }
};

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'material-database'
    });
});

app.get('/api/materials/pricing/:item', (req, res) => {
    const item = req.params.item;
    const pricing = MATERIAL_PRICES[item];
    
    if (pricing) {
        res.json({
            item: item,
            ...pricing,
            source: "electrical-materials-db"
        });
    } else {
        res.status(404).json({ error: "Material not found" });
    }
});

app.get('/api/materials/pricing', (req, res) => {
    res.json({
        materials: MATERIAL_PRICES,
        total_items: Object.keys(MATERIAL_PRICES).length,
        last_updated: "2024-01-01"
    });
});

app.post('/api/materials/bulk-pricing', (req, res) => {
    const { materials } = req.body;
    const results = {};
    
    for (const material of materials) {
        if (MATERIAL_PRICES[material]) {
            results[material] = MATERIAL_PRICES[material];
        }
    }
    
    res.json({
        requested: materials.length,
        found: Object.keys(results).length,
        pricing: results
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`💰 Material Database service running on port ${port}`);
});
EOF

cat > plugins/material-database/healthcheck.js << 'EOF'
const http = require('http');

const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3003,
    path: '/health',
    method: 'GET',
    timeout: 2000
};

const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

req.on('error', () => {
    process.exit(1);
});

req.on('timeout', () => {
    req.destroy();
    process.exit(1);
});

req.end();
EOF

# Create N8N with custom electrical nodes
mkdir -p n8n

cat > n8n/Dockerfile << 'EOF'
FROM n8nio/n8n:1.19.4

USER root

# Install additional dependencies for electrical calculations
RUN npm install -g npm@latest

# Copy custom electrical nodes
COPY custom-nodes/ /home/node/.n8n/custom/

# Install custom node dependencies
WORKDIR /home/node/.n8n/custom/
RUN npm install

# Switch back to n8n user
USER node
WORKDIR /home/node

# Copy workflows
COPY workflows/ /home/node/.n8n/workflows/

CMD ["n8n"]
EOF

# Create custom electrical calculation node
mkdir -p n8n/custom-nodes

cat > n8n/custom-nodes/package.json << 'EOF'
{
  "name": "n8n-nodes-electrical-calculator",
  "version": "1.0.0",
  "description": "Custom N8N nodes for electrical calculations",
  "main": "index.js",
  "n8n": {
    "nodes": [
      "dist/ElectricalLoadCalculator.node.js",
      "dist/WireSizingCalculator.node.js"
    ]
  },
  "dependencies": {
    "n8n-workflow": "^1.19.4"
  }
}
EOF

print_success "Container definitions prepared"

# Start the Cloud Build
print_status "Starting Cloud Build deployment..."

$GCLOUD builds submit . \
    --config=cloud-build.yaml \
    --substitutions=_ENVIRONMENT=dev,_REGION=us-central1 \
    --timeout=3600s || {
    print_error "Cloud Build failed"
    exit 1
}

print_success "🎉 Deployment completed successfully!"

# Get cluster credentials for local access
print_status "Configuring local kubectl access..."
$GCLOUD container clusters get-credentials electrical-estimation-dev \
    --region=us-central1 \
    --project="$PROJECT_ID" 2>/dev/null || {
    print_warning "Could not configure kubectl access"
}

# Display final information
print_header "🚀 DEPLOYMENT COMPLETE"
echo ""
echo "📊 System Information:"
echo "├── Project ID: $PROJECT_ID"
echo "├── Cluster: electrical-estimation-dev"
echo "├── Region: us-central1"
echo "├── Domain: $DOMAIN_NAME"
echo "└── Environment: dev"
echo ""
echo "🔐 Access Credentials:"
echo "├── N8N Username: admin"
echo "├── N8N Password: $N8N_PASSWORD"
echo "└── Database Password: [Stored in Secret Manager]"
echo ""
echo "🔧 Next Steps:"
echo "1. Configure DNS: Point $DOMAIN_NAME to Load Balancer IP"
echo "2. Wait for SSL certificate (up to 30 minutes)"
echo "3. Access N8N at: https://$DOMAIN_NAME"
echo "4. Monitor in GCP Console > Cloud Build > History"
echo ""
echo "📚 Useful Commands:"
echo "• Check pods: kubectl get pods -n electrical-estimation"
echo "• View logs: kubectl logs -f deployment/electrical-calculator -n electrical-estimation"
echo "• Get LB IP: kubectl get ingress -n electrical-estimation"
echo ""

print_success "Your electrical estimation system is deployed and ready! 🎯"