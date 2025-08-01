#!/bin/sh

# 🚀 N8N Startup Script for ElectricalAI Pro
# Handles initialization and custom configuration

set -e

echo "🚀 Starting N8N for ElectricalAI Pro..."

# Wait for database to be ready
if [ "$DB_TYPE" = "postgresdb" ]; then
    echo "⏳ Waiting for PostgreSQL to be ready..."
    until PGPASSWORD=$DB_POSTGRESDB_PASSWORD psql -h "$DB_POSTGRESDB_HOST" -U "$DB_POSTGRESDB_USER" -d "$DB_POSTGRESDB_DATABASE" -c '\q' 2>/dev/null; do
        echo "PostgreSQL is unavailable - sleeping"
        sleep 2
    done
    echo "✅ PostgreSQL is ready!"
fi

# Create required tables if they don't exist
if [ "$DB_TYPE" = "postgresdb" ] && [ "$NODE_ENV" = "production" ]; then
    echo "📊 Initializing database schema..."
    PGPASSWORD=$DB_POSTGRESDB_PASSWORD psql -h "$DB_POSTGRESDB_HOST" -U "$DB_POSTGRESDB_USER" -d "$DB_POSTGRESDB_DATABASE" <<-EOSQL
        -- Create custom tables for ElectricalAI Pro integration
        CREATE TABLE IF NOT EXISTS electrical_workflows (
            id SERIAL PRIMARY KEY,
            workflow_id VARCHAR(255) UNIQUE NOT NULL,
            project_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            result JSONB,
            metadata JSONB
        );

        CREATE TABLE IF NOT EXISTS workflow_logs (
            id SERIAL PRIMARY KEY,
            workflow_id VARCHAR(255) NOT NULL,
            execution_id VARCHAR(255),
            level VARCHAR(20),
            message TEXT,
            details JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_electrical_workflows_project_id ON electrical_workflows(project_id);
        CREATE INDEX IF NOT EXISTS idx_electrical_workflows_status ON electrical_workflows(status);
        CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow_id ON workflow_logs(workflow_id);
        CREATE INDEX IF NOT EXISTS idx_workflow_logs_created_at ON workflow_logs(created_at);
EOSQL
    echo "✅ Database schema initialized!"
fi

# Import default workflows if this is first run
if [ ! -f "/home/node/.n8n/.initialized" ]; then
    echo "📦 Importing default ElectricalAI Pro workflows..."
    
    # Create initialization flag
    touch /home/node/.n8n/.initialized
    
    # Import workflow templates
    for workflow in /home/node/.n8n/workflows/*.json; do
        if [ -f "$workflow" ]; then
            echo "Importing workflow: $(basename "$workflow")"
            # Note: This would normally use n8n CLI import command
            # For now, workflows will be imported via the UI
        fi
    done
fi

# Configure environment for ElectricalAI Pro
export N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/custom"
export N8N_USER_FOLDER="/home/node/.n8n"
export N8N_DISABLE_PRODUCTION_MAIN_PROCESS="${N8N_DISABLE_PRODUCTION_MAIN_PROCESS:-false}"

# Set execution mode based on process type
if [ "$EXECUTIONS_PROCESS" = "worker" ]; then
    echo "🔧 Starting N8N in worker mode..."
    exec n8n worker
else
    echo "🚀 Starting N8N in main mode..."
    
    # Start N8N with webhook support
    if [ "$NODE_ENV" = "production" ]; then
        exec n8n start --tunnel=false
    else
        # Development mode with tunnel for testing
        exec n8n start --tunnel
    fi
fi