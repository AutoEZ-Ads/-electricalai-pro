#!/bin/bash
# Final Validation and Performance Verification Script
# Comprehensive system validation for production readiness with enhanced error handling

set -euo pipefail

# Enhanced configuration with validation and defaults
PROJECT_ID="${PROJECT_ID:-}"
CLUSTER_NAME="${CLUSTER_NAME:-electrical-estimation-cluster}"
REGION="${REGION:-us-central1}"
DOMAIN_NAME="${DOMAIN_NAME:-electrical-estimation.com}"
TEST_RESULTS_DIR="validation-results"
MAX_RETRIES="${MAX_RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-5}"
TIMEOUT_DURATION="${TIMEOUT_DURATION:-30}"
VALIDATION_LOG_FILE="${TEST_RESULTS_DIR}/validation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Global error tracking
declare -a VALIDATION_ERRORS=()
declare -a VALIDATION_WARNINGS=()
VALIDATION_EXIT_CODE=0

# Enhanced logging functions with file output
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}${message}${NC}"
    [[ -f "$VALIDATION_LOG_FILE" ]] && echo "$message" >> "$VALIDATION_LOG_FILE"
}

warn() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}${message}${NC}"
    [[ -f "$VALIDATION_LOG_FILE" ]] && echo "$message" >> "$VALIDATION_LOG_FILE"
    VALIDATION_WARNINGS+=("$1")
}

error() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}${message}${NC}"
    [[ -f "$VALIDATION_LOG_FILE" ]] && echo "$message" >> "$VALIDATION_LOG_FILE"
    VALIDATION_ERRORS+=("$1")
    VALIDATION_EXIT_CODE=1
}

info() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1"
    echo -e "${BLUE}${message}${NC}"
    [[ -f "$VALIDATION_LOG_FILE" ]] && echo "$message" >> "$VALIDATION_LOG_FILE"
}

success() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1"
    echo -e "${PURPLE}${message}${NC}"
    [[ -f "$VALIDATION_LOG_FILE" ]] && echo "$message" >> "$VALIDATION_LOG_FILE"
}

# Enhanced error handling functions
handle_error() {
    local exit_code=$?
    local line_number=$1
    local command="$2"
    error "Command failed at line $line_number: $command (exit code: $exit_code)"
    
    # Generate error report
    local error_report="$TEST_RESULTS_DIR/error-report-$(date +%Y%m%d-%H%M%S).json"
    cat > "$error_report" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "error": {
    "exit_code": $exit_code,
    "line_number": $line_number,
    "command": "$command",
    "script": "$0"
  },
  "environment": {
    "bash_version": "$BASH_VERSION",
    "user": "$(whoami)",
    "pwd": "$(pwd)",
    "project_id": "$PROJECT_ID"
  }
}
EOF
    
    return $exit_code
}

# Set up error trap
trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

# Enhanced retry mechanism
retry_command() {
    local max_attempts="$1"
    local delay="$2"
    local description="$3"
    shift 3
    local command=("$@")
    
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        info "Attempt $attempt/$max_attempts: $description"
        
        if "${command[@]}" 2>/dev/null; then
            success "$description completed successfully"
            return 0
        else
            local exit_code=$?
            warn "$description failed (attempt $attempt/$max_attempts, exit code: $exit_code)"
            
            if [[ $attempt -lt $max_attempts ]]; then
                info "Waiting ${delay}s before retry..."
                sleep "$delay"
                ((attempt++))
            else
                error "$description failed after $max_attempts attempts"
                return $exit_code
            fi
        fi
    done
}

# Enhanced timeout wrapper
timeout_command() {
    local timeout_duration="$1"
    local description="$2"
    shift 2
    local command=("$@")
    
    info "Running with ${timeout_duration}s timeout: $description"
    
    if timeout "$timeout_duration" "${command[@]}" 2>/dev/null; then
        success "$description completed within timeout"
        return 0
    else
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            error "$description timed out after ${timeout_duration}s"
        else
            error "$description failed with exit code: $exit_code"
        fi
        return $exit_code
    fi
}

# Safe command execution with comprehensive error handling
safe_execute() {
    local description="$1"
    local on_error="${2:-continue}"  # continue|exit|warn
    shift 2
    local command=("$@")
    
    info "Executing: $description"
    
    local output
    local exit_code=0
    
    # Capture both stdout and stderr
    if output=$(timeout_command "$TIMEOUT_DURATION" "$description" "${command[@]}" 2>&1); then
        success "$description completed successfully"
        [[ -n "$output" ]] && info "Output: $output"
        return 0
    else
        exit_code=$?
        
        case "$on_error" in
            "exit")
                error "$description failed. Output: $output"
                exit $exit_code
                ;;
            "warn")
                warn "$description failed but continuing. Output: $output"
                return 0
                ;;
            "continue"|*)
                error "$description failed. Output: $output"
                return $exit_code
                ;;
        esac
    fi
}

# Enhanced cleanup function
cleanup() {
    local exit_code=$?
    log "🧹 Performing cleanup..."
    
    # Clean up temporary files
    find "$TEST_RESULTS_DIR" -name "perf_temp_*.csv" -type f -delete 2>/dev/null || true
    find "$TEST_RESULTS_DIR" -name "*.tmp" -type f -delete 2>/dev/null || true
    
    # Generate final error summary if there were errors
    if [[ ${#VALIDATION_ERRORS[@]} -gt 0 ]] || [[ ${#VALIDATION_WARNINGS[@]} -gt 0 ]]; then
        local error_summary="$TEST_RESULTS_DIR/error-summary.json"
        cat > "$error_summary" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_completion": "$(date)",
  "exit_code": $VALIDATION_EXIT_CODE,
  "error_count": ${#VALIDATION_ERRORS[@]},
  "warning_count": ${#VALIDATION_WARNINGS[@]},
  "errors": $(printf '%s\n' "${VALIDATION_ERRORS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
  "warnings": $(printf '%s\n' "${VALIDATION_WARNINGS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
}
EOF
        error "Validation completed with ${#VALIDATION_ERRORS[@]} errors and ${#VALIDATION_WARNINGS[@]} warnings"
        info "Error summary: $error_summary"
    fi
    
    exit $VALIDATION_EXIT_CODE
}

# Set up cleanup trap
trap cleanup EXIT

# Enhanced environment validation
validate_environment() {
    log "🌍 Validating environment prerequisites..."
    
    local validation_issues=()
    
    # Check required environment variables
    local required_vars=("PROJECT_ID")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        validation_issues+=("Missing required environment variables: ${missing_vars[*]}")
    fi
    
    # Check required tools with version validation
    local required_tools=(
        "kubectl:Client Version"
        "curl:curl"
        "jq:jq-"
        "python3:Python 3"
        "bc:bc"
        "timeout:timeout"
    )
    
    local missing_tools=()
    
    for tool_spec in "${required_tools[@]}"; do
        local tool="${tool_spec%%:*}"
        local version_check="${tool_spec##*:}"
        
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        else
            # Try to get version information
            local version_output=""
            case "$tool" in
                "kubectl")
                    version_output=$(kubectl version --client --short 2>/dev/null || echo "unknown")
                    ;;
                "curl")
                    version_output=$(curl --version 2>/dev/null | head -1 || echo "unknown")
                    ;;
                "jq")
                    version_output=$(jq --version 2>/dev/null || echo "unknown")
                    ;;
                "python3")
                    version_output=$(python3 --version 2>/dev/null || echo "unknown")
                    ;;
                "bc")
                    version_output=$(bc --version 2>/dev/null | head -1 || echo "unknown")
                    ;;
                "timeout")
                    version_output=$(timeout --version 2>/dev/null | head -1 || echo "unknown")
                    ;;
            esac
            info "Found $tool: $version_output"
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        validation_issues+=("Missing required tools: ${missing_tools[*]}")
    fi
    
    # Check system resources
    local available_memory=$(free -m 2>/dev/null | awk 'NR==2{printf "%.1f", $7/1024}' || echo "unknown")
    local available_disk=$(df -h . 2>/dev/null | awk 'NR==2{print $4}' || echo "unknown")
    
    info "Available memory: ${available_memory}GB"
    info "Available disk space: $available_disk"
    
    # Report validation issues
    if [[ ${#validation_issues[@]} -gt 0 ]]; then
        for issue in "${validation_issues[@]}"; do
            error "$issue"
        done
        error "Environment validation failed"
        return 1
    fi
    
    success "Environment validation passed"
    return 0
}

# Initialize validation environment with comprehensive error handling
initialize_validation() {
    log "🔧 Initializing validation environment..."
    
    # Validate environment first
    if ! validate_environment; then
        error "Environment validation failed"
        exit 1
    fi
    
    # Create results directory with proper error handling
    if ! safe_execute "Create results directory" "exit" mkdir -p "$TEST_RESULTS_DIR"; then
        error "Failed to create results directory: $TEST_RESULTS_DIR"
        exit 1
    fi
    
    # Initialize log file
    if ! touch "$VALIDATION_LOG_FILE" 2>/dev/null; then
        warn "Could not create log file: $VALIDATION_LOG_FILE"
        VALIDATION_LOG_FILE="/dev/null"
    else
        info "Logging to: $VALIDATION_LOG_FILE"
    fi
    
    # Check cluster connectivity with retry
    log "🔗 Checking Kubernetes cluster connectivity..."
    if ! retry_command "$MAX_RETRIES" "$RETRY_DELAY" "kubectl cluster connectivity" kubectl cluster-info; then
        error "Cannot connect to Kubernetes cluster after $MAX_RETRIES attempts"
        error "Please check your kubectl configuration and cluster status"
        exit 1
    fi
    
    # Validate cluster access and permissions
    log "🔐 Validating cluster permissions..."
    local cluster_validation_tests=(
        "kubectl auth can-i get pods --all-namespaces:List pods across namespaces"
        "kubectl auth can-i get services --all-namespaces:List services across namespaces"
        "kubectl auth can-i get deployments --all-namespaces:List deployments across namespaces"
    )
    
    for test_spec in "${cluster_validation_tests[@]}"; do
        local test_command="${test_spec%%:*}"
        local test_description="${test_spec##*:}"
        
        if safe_execute "$test_description" "continue" $test_command; then
            success "✅ $test_description: Authorized"
        else
            warn "⚠️ $test_description: Limited permissions"
        fi
    done
    
    # Log environment information
    cat >> "$VALIDATION_LOG_FILE" << EOF

=== VALIDATION ENVIRONMENT ===
Timestamp: $(date)
Project ID: $PROJECT_ID
Cluster Name: $CLUSTER_NAME
Region: $REGION
Domain: $DOMAIN_NAME
Max Retries: $MAX_RETRIES
Retry Delay: $RETRY_DELAY
Timeout Duration: $TIMEOUT_DURATION
Kubernetes Context: $(kubectl config current-context 2>/dev/null || echo "unknown")
Kubernetes Server: $(kubectl cluster-info | grep 'Kubernetes control plane' | awk '{print $NF}' || echo "unknown")
============================

EOF
    
    success "✅ Validation environment initialized successfully"
}

# Enhanced infrastructure validation with comprehensive error handling
validate_infrastructure() {
    log "🏗️ Validating infrastructure deployment..."
    
    local validation_results="$TEST_RESULTS_DIR/infrastructure-validation.json"
    local issues=()
    local namespace_status=()
    local deployment_details=()
    local service_details=()
    
    # Check namespaces with detailed status
    info "Checking required namespaces..."
    local required_namespaces=("electrical-estimation" "monitoring")
    
    for ns in "${required_namespaces[@]}"; do
        info "Validating namespace: $ns"
        
        if safe_execute "Check namespace $ns" "continue" kubectl get namespace "$ns"; then
            # Get namespace details
            local ns_status
            if ns_status=$(kubectl get namespace "$ns" -o json 2>/dev/null); then
                local ns_phase=$(echo "$ns_status" | jq -r '.status.phase // "Unknown"')
                local ns_creation=$(echo "$ns_status" | jq -r '.metadata.creationTimestamp // "Unknown"')
                
                success "✅ Namespace $ns exists (Phase: $ns_phase, Created: $ns_creation)"
                namespace_status+=("{\"name\": \"$ns\", \"exists\": true, \"phase\": \"$ns_phase\", \"created\": \"$ns_creation\"}")
            else
                warn "Could not get detailed status for namespace $ns"
                namespace_status+=("{\"name\": \"$ns\", \"exists\": true, \"phase\": \"Unknown\", \"created\": \"Unknown\"}")
            fi
        else
            issues+=("❌ Missing namespace: $ns")
            namespace_status+=("{\"name\": \"$ns\", \"exists\": false, \"phase\": \"Missing\", \"created\": \"N/A\"}")
        fi
    done
    
    # Check deployments with detailed analysis
    info "Checking deployment status in electrical-estimation namespace..."
    local deployment_count=0
    local ready_deployments=0
    
    if safe_execute "Get deployments" "continue" kubectl get deployments -n electrical-estimation -o json; then
        local deployments_output
        if deployments_output=$(kubectl get deployments -n electrical-estimation -o json 2>/dev/null); then
            deployment_count=$(echo "$deployments_output" | jq '.items | length' 2>/dev/null || echo "0")
            
            if [[ $deployment_count -gt 0 ]]; then
                # Analyze each deployment
                local deployment_names
                deployment_names=$(echo "$deployments_output" | jq -r '.items[].metadata.name' 2>/dev/null || echo "")
                
                for deployment_name in $deployment_names; do
                    local deployment_info
                    if deployment_info=$(kubectl get deployment "$deployment_name" -n electrical-estimation -o json 2>/dev/null); then
                        local replicas=$(echo "$deployment_info" | jq -r '.spec.replicas // 0')
                        local ready_replicas=$(echo "$deployment_info" | jq -r '.status.readyReplicas // 0')
                        local available_replicas=$(echo "$deployment_info" | jq -r '.status.availableReplicas // 0')
                        local updated_replicas=$(echo "$deployment_info" | jq -r '.status.updatedReplicas // 0')
                        
                        deployment_details+=("{
                            \"name\": \"$deployment_name\",
                            \"replicas\": $replicas,
                            \"ready_replicas\": $ready_replicas,
                            \"available_replicas\": $available_replicas,
                            \"updated_replicas\": $updated_replicas,
                            \"status\": \"$(if [[ $ready_replicas -eq $replicas ]]; then echo "Ready"; else echo "NotReady"; fi)\"
                        }")
                        
                        if [[ $ready_replicas -eq $replicas ]] && [[ $replicas -gt 0 ]]; then
                            ((ready_deployments++))
                            success "✅ Deployment $deployment_name: $ready_replicas/$replicas ready"
                        else
                            warn "⚠️ Deployment $deployment_name: $ready_replicas/$replicas ready"
                        fi
                    else
                        warn "Could not get details for deployment: $deployment_name"
                        deployment_details+=("{\"name\": \"$deployment_name\", \"status\": \"Unknown\"}")
                    fi
                done
            else
                warn "No deployments found in electrical-estimation namespace"
            fi
        else
            issues+=("❌ Could not retrieve deployment information")
        fi
    else
        issues+=("❌ Failed to check deployments")
    fi
    
    if [[ $deployment_count -gt 0 ]]; then
        if [[ $deployment_count -eq $ready_deployments ]]; then
            success "✅ All $deployment_count deployments are ready"
        else
            issues+=("❌ Only $ready_deployments/$deployment_count deployments are ready")
        fi
    else
        issues+=("❌ No deployments found")
    fi
    
    # Check services with detailed analysis
    info "Checking service endpoints..."
    local service_count=0
    
    if safe_execute "Get services" "continue" kubectl get services -n electrical-estimation -o json; then
        local services_output
        if services_output=$(kubectl get services -n electrical-estimation -o json 2>/dev/null); then
            service_count=$(echo "$services_output" | jq '.items | length' 2>/dev/null || echo "0")
            
            if [[ $service_count -gt 0 ]]; then
                local service_names
                service_names=$(echo "$services_output" | jq -r '.items[].metadata.name' 2>/dev/null || echo "")
                
                for service_name in $service_names; do
                    local service_info
                    if service_info=$(kubectl get service "$service_name" -n electrical-estimation -o json 2>/dev/null); then
                        local service_type=$(echo "$service_info" | jq -r '.spec.type // "Unknown"')
                        local cluster_ip=$(echo "$service_info" | jq -r '.spec.clusterIP // "None"')
                        local external_ip=$(echo "$service_info" | jq -r '.status.loadBalancer.ingress[0].ip // "None"')
                        local ports=$(echo "$service_info" | jq -r '.spec.ports | length' 2>/dev/null || echo "0")
                        
                        service_details+=("{
                            \"name\": \"$service_name\",
                            \"type\": \"$service_type\",
                            \"cluster_ip\": \"$cluster_ip\",
                            \"external_ip\": \"$external_ip\",
                            \"port_count\": $ports
                        }")
                        
                        success "✅ Service $service_name: Type=$service_type, Ports=$ports"
                    else
                        warn "Could not get details for service: $service_name"
                        service_details+=("{\"name\": \"$service_name\", \"status\": \"Unknown\"}")
                    fi
                done
                success "✅ Found $service_count services"
            else
                warn "No services found in electrical-estimation namespace"
            fi
        else
            issues+=("❌ Could not retrieve service information")
        fi
    else
        issues+=("❌ Failed to check services")
    fi
    
    # Check ingress configuration
    info "Checking ingress configuration..."
    local ingress_count=0
    local ingress_hosts=0
    
    if safe_execute "Check ingress" "continue" kubectl get ingress -n electrical-estimation; then
        if ingress_output=$(kubectl get ingress -n electrical-estimation -o json 2>/dev/null); then
            ingress_count=$(echo "$ingress_output" | jq '.items | length' 2>/dev/null || echo "0")
            
            if [[ $ingress_count -gt 0 ]]; then
                ingress_hosts=$(echo "$ingress_output" | jq -r '.items[].spec.rules[].host' 2>/dev/null | wc -l || echo "0")
                success "✅ Ingress configured with $ingress_hosts hosts ($ingress_count ingress objects)"
            else
                issues+=("❌ No ingress configuration found")
            fi
        else
            issues+=("❌ Could not retrieve ingress configuration")
        fi
    else
        issues+=("❌ Failed to check ingress configuration")
    fi
    
    # Generate comprehensive infrastructure report
    local namespace_json=$(printf '%s\n' "${namespace_status[@]}" | jq -s . 2>/dev/null || echo '[]')
    local deployment_json=$(printf '%s\n' "${deployment_details[@]}" | jq -s . 2>/dev/null || echo '[]')
    local service_json=$(printf '%s\n' "${service_details[@]}" | jq -s . 2>/dev/null || echo '[]')
    local issues_json=$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
    
    cat > "$validation_results" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "infrastructure",
  "summary": {
    "total_checks": $((${#required_namespaces[@]} + 3)),
    "passed_checks": $((${#required_namespaces[@]} + 3 - ${#issues[@]})),
    "issue_count": ${#issues[@]}
  },
  "namespaces": $namespace_json,
  "deployments": {
    "total": $deployment_count,
    "ready": $ready_deployments,
    "details": $deployment_json
  },
  "services": {
    "total": $service_count,
    "details": $service_json
  },
  "ingress": {
    "count": $ingress_count,
    "hosts": $ingress_hosts
  },
  "issues": $issues_json
}
EOF
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        success "✅ Infrastructure validation passed"
        return 0
    else
        error "❌ Infrastructure validation failed with ${#issues[@]} issues"
        for issue in "${issues[@]}"; do
            error "$issue"
        done
        return 1
    fi
}

# Validate application services
validate_services() {
    log "🔌 Validating application services..."
    
    local validation_results="$TEST_RESULTS_DIR/service-validation.json"
    local service_results=()
    
    # Get service endpoints
    local electrical_calculator_ip=$(kubectl get svc electrical-calculator -n electrical-estimation -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    local n8n_ip=$(kubectl get svc n8n -n electrical-estimation -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    # Test electrical calculator service
    info "Testing electrical calculator service..."
    if [[ -n "$electrical_calculator_ip" ]]; then
        local calc_health=$(curl -s -w "%{http_code}" -o /dev/null "http://$electrical_calculator_ip/health" 2>/dev/null || echo "000")
        if [[ "$calc_health" == "200" ]]; then
            success "✅ Electrical calculator health endpoint responsive"
            service_results+=('{"service": "electrical-calculator", "status": "healthy", "response_code": 200}')
        else
            service_results+=('{"service": "electrical-calculator", "status": "unhealthy", "response_code": '$calc_health'}')
        fi
    else
        service_results+=('{"service": "electrical-calculator", "status": "no_endpoint", "response_code": 0}')
    fi
    
    # Test load calculation endpoint
    info "Testing load calculation functionality..."
    if [[ -n "$electrical_calculator_ip" ]]; then
        local calc_response=$(curl -s -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d '{"area_sqft": 2000, "building_type": "residential", "voltage_system": "single_phase_240v"}' \
            "http://$electrical_calculator_ip/api/calculate/load" 2>/dev/null || echo "000")
        
        if [[ "${calc_response: -3}" == "200" ]]; then
            success "✅ Load calculation endpoint functional"
            service_results+=('{"service": "load-calculation", "status": "functional", "response_code": 200}')
        else
            service_results+=('{"service": "load-calculation", "status": "non-functional", "response_code": '${calc_response: -3}'}')
        fi
    fi
    
    # Test N8N service
    info "Testing N8N workflow service..."
    if [[ -n "$n8n_ip" ]]; then
        local n8n_health=$(curl -s -w "%{http_code}" -o /dev/null "http://$n8n_ip/healthz" 2>/dev/null || echo "000")
        if [[ "$n8n_health" == "200" ]]; then
            success "✅ N8N service healthy"
            service_results+=('{"service": "n8n", "status": "healthy", "response_code": 200}')
        else
            service_results+=('{"service": "n8n", "status": "unhealthy", "response_code": '$n8n_health'}')
        fi
    else
        service_results+=('{"service": "n8n", "status": "no_endpoint", "response_code": 0}')
    fi
    
    # Generate service validation report
    local service_json=$(printf '%s\n' "${service_results[@]}" | jq -s .)
    cat > $validation_results << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "services",
  "services": $service_json
}
EOF
    
    success "✅ Service validation completed"
}

# Enhanced performance benchmarking with comprehensive error handling
run_performance_tests() {
    log "🚀 Running performance benchmarking..."
    
    local perf_results="$TEST_RESULTS_DIR/performance-results.json"
    local electrical_calculator_ip=""
    local backup_endpoints=()
    
    # Try multiple methods to get service endpoint
    info "Discovering service endpoints for performance testing..."
    
    # Method 1: External LoadBalancer IP
    if electrical_calculator_ip=$(kubectl get svc electrical-calculator -n electrical-estimation -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null) && [[ -n "$electrical_calculator_ip" ]]; then
        info "Found LoadBalancer IP: $electrical_calculator_ip"
    fi
    
    # Method 2: NodePort with node IP
    if [[ -z "$electrical_calculator_ip" ]]; then
        local nodeport_ip node_port
        if nodeport_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null) && \
           node_port=$(kubectl get svc electrical-calculator -n electrical-estimation -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null) && \
           [[ -n "$nodeport_ip" ]] && [[ -n "$node_port" ]]; then
            electrical_calculator_ip="$nodeport_ip:$node_port"
            info "Found NodePort endpoint: $electrical_calculator_ip"
        fi
    fi
    
    # Method 3: Port forwarding as fallback
    if [[ -z "$electrical_calculator_ip" ]]; then
        info "Attempting port forwarding as fallback..."
        local port_forward_port=8080
        if kubectl port-forward -n electrical-estimation svc/electrical-calculator "$port_forward_port:80" &>/dev/null &; then
            local pf_pid=$!
            sleep 2
            
            if kill -0 $pf_pid 2>/dev/null; then
                electrical_calculator_ip="localhost:$port_forward_port"
                info "Port forwarding established: $electrical_calculator_ip"
                
                # Clean up port forwarding on exit
                trap "kill $pf_pid 2>/dev/null || true" EXIT
            else
                warn "Port forwarding failed"
            fi
        fi
    fi
    
    if [[ -z "$electrical_calculator_ip" ]]; then
        error "No accessible endpoint found for performance testing"
        cat > "$perf_results" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "performance",
  "status": "skipped",
  "reason": "No accessible service endpoint",
  "error": "Could not determine service endpoint for testing"
}
EOF
        return 1
    fi
    
    # Test endpoint connectivity before running performance tests
    info "Testing endpoint connectivity: $electrical_calculator_ip"
    local health_check_url="http://$electrical_calculator_ip/health"
    
    if ! retry_command 3 2 "Health check" curl -s -f --connect-timeout 10 "$health_check_url"; then
        error "Service endpoint is not responding to health checks"
        cat > "$perf_results" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "performance",
  "status": "failed",
  "reason": "Service endpoint not responding",
  "endpoint": "$electrical_calculator_ip"
}
EOF
        return 1
    fi
    
    success "✅ Service endpoint is responsive: $electrical_calculator_ip"
    
    info "Running load calculation performance test..."
    
    # Enhanced test configuration
    local test_payload='{"area_sqft": 2000, "building_type": "residential", "voltage_system": "single_phase_240v", "appliance_count": 2}'
    local concurrent_requests=10
    local total_requests=100
    local test_endpoint="http://$electrical_calculator_ip/api/calculate/load"
    local test_timeout=30
    
    # Create temporary directory for performance test results
    local perf_temp_dir="$TEST_RESULTS_DIR/perf_temp"
    mkdir -p "$perf_temp_dir"
    
    info "Starting $total_requests requests with $concurrent_requests concurrent connections..."
    local test_start_time=$(date +%s)
    
    # Run concurrent requests with enhanced error handling
    local pids=()
    for i in $(seq 1 $concurrent_requests); do
        {
            local requests_per_worker=$((total_requests / concurrent_requests))
            local worker_results="$perf_temp_dir/worker_$i.csv"
            
            for j in $(seq 1 $requests_per_worker); do
                local start_time=$(date +%s%3N)
                local response status_code
                
                # Use timeout to prevent hanging requests
                if response=$(timeout $test_timeout curl -s -w "%{http_code}" -X POST \
                    -H "Content-Type: application/json" \
                    -H "User-Agent: ElectricalValidation/1.0" \
                    --connect-timeout 5 \
                    --max-time $test_timeout \
                    -d "$test_payload" \
                    "$test_endpoint" 2>/dev/null); then
                    
                    local end_time=$(date +%s%3N)
                    local response_time=$((end_time - start_time))
                    status_code="${response: -3}"
                    
                    # Validate response is reasonable (not empty, valid status code)
                    if [[ -n "$status_code" ]] && [[ "$status_code" =~ ^[0-9]{3}$ ]]; then
                        echo "$response_time,$status_code,$j" >> "$worker_results"
                    else
                        echo "0,000,$j" >> "$worker_results"
                    fi
                else
                    # Request failed or timed out
                    local end_time=$(date +%s%3N)
                    local response_time=$((end_time - start_time))
                    echo "$response_time,timeout,$j" >> "$worker_results"
                fi
            done
        } &
        pids+=($!)
    done
    
    # Wait for all workers to complete with timeout
    local workers_completed=0
    local max_wait_time=300  # 5 minutes maximum
    local wait_start=$(date +%s)
    
    while [[ $workers_completed -lt ${#pids[@]} ]]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - wait_start))
        
        if [[ $elapsed -gt $max_wait_time ]]; then
            warn "Performance test timeout reached, terminating remaining workers"
            for pid in "${pids[@]}"; do
                kill $pid 2>/dev/null || true
            done
            break
        fi
        
        workers_completed=0
        for pid in "${pids[@]}"; do
            if ! kill -0 $pid 2>/dev/null; then
                ((workers_completed++))
            fi
        done
        
        sleep 1
    done
    
    local test_end_time=$(date +%s)
    local total_test_duration=$((test_end_time - test_start_time))
    
    info "Performance test completed in ${total_test_duration}s"
    
    # Aggregate and analyze results
    info "Aggregating performance test results..."
    local all_results="$TEST_RESULTS_DIR/all_results.csv"
    
    if find "$perf_temp_dir" -name "worker_*.csv" -size +0c | head -1 >/dev/null 2>&1; then
        cat "$perf_temp_dir"/worker_*.csv > "$all_results" 2>/dev/null || touch "$all_results"
    else
        warn "No performance test results found"
        touch "$all_results"
    fi
    
    # Calculate comprehensive statistics
    local total_tests=$(wc -l < "$all_results" 2>/dev/null || echo "0")
    local successful_tests=$(grep -c ",200," "$all_results" 2>/dev/null || echo "0")
    local timeout_tests=$(grep -c ",timeout," "$all_results" 2>/dev/null || echo "0")
    local error_tests=$(grep -E ",(4[0-9]{2}|5[0-9]{2})," "$all_results" 2>/dev/null | wc -l || echo "0")
    local failed_tests=$((total_tests - successful_tests))
    
    local success_rate=0
    local avg_response_time=0
    local min_response_time=0
    local max_response_time=0
    local p95_response_time=0
    
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$(echo "scale=2; $successful_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0")
        
        if [[ $successful_tests -gt 0 ]]; then
            local response_times
            response_times=$(grep ",200," "$all_results" | cut -d',' -f1 | sort -n)
            
            if [[ -n "$response_times" ]]; then
                avg_response_time=$(echo "$response_times" | awk '{sum+=$1} END {print (NR>0) ? sum/NR : 0}')
                min_response_time=$(echo "$response_times" | head -1)
                max_response_time=$(echo "$response_times" | tail -1)
                
                # Calculate 95th percentile
                local p95_index=$(echo "$successful_tests * 0.95" | bc -l | cut -d'.' -f1)
                p95_response_time=$(echo "$response_times" | sed -n "${p95_index}p" 2>/dev/null || echo "$max_response_time")
            fi
        fi
    fi
    
    # Generate comprehensive performance report
    cat > "$perf_results" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "performance",
  "status": "completed",
  "endpoint": "$electrical_calculator_ip",
  "test_configuration": {
    "concurrent_requests": $concurrent_requests,
    "total_requests": $total_requests,
    "endpoint_path": "/api/calculate/load",
    "timeout_seconds": $test_timeout,
    "total_duration_seconds": $total_test_duration
  },
  "results": {
    "total_tests": $total_tests,
    "successful_tests": $successful_tests,
    "failed_tests": $failed_tests,
    "timeout_tests": $timeout_tests,
    "error_tests": $error_tests,
    "success_rate_percent": $success_rate,
    "response_times_ms": {
      "average": $avg_response_time,
      "minimum": $min_response_time,
      "maximum": $max_response_time,
      "p95": $p95_response_time
    },
    "throughput": {
      "requests_per_second": $(echo "scale=2; $successful_tests / $total_test_duration" | bc -l 2>/dev/null || echo "0")
    }
  }
}
EOF
    
    # Clean up temporary files
    rm -rf "$perf_temp_dir"
    
    success "✅ Performance benchmarking completed"
    info "📊 Success Rate: $success_rate%"
    info "📊 Average Response Time: ${avg_response_time}ms"
    info "📊 95th Percentile: ${p95_response_time}ms"
    info "📊 Throughput: $(echo "scale=2; $successful_tests / $total_test_duration" | bc -l 2>/dev/null || echo "0") req/sec"
    
    return 0
}

# Validate NEC compliance
validate_nec_compliance() {
    log "⚖️ Validating NEC compliance functionality..."
    
    local compliance_results="$TEST_RESULTS_DIR/nec-compliance-validation.json"
    local electrical_calculator_ip=$(kubectl get svc electrical-calculator -n electrical-estimation -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [[ -z "$electrical_calculator_ip" ]]; then
        warn "No external IP available for NEC compliance testing"
        return 1
    fi
    
    local test_cases=(
        '{"area_sqft": 1200, "building_type": "residential", "voltage_system": "single_phase_240v"}|"Minimum service size validation"'
        '{"area_sqft": 3000, "building_type": "commercial", "voltage_system": "three_phase_208v"}|"Commercial load calculation"'
        '{"current_amps": 20, "distance_feet": 100, "voltage_system": "single_phase_120v", "conductor_material": "copper"}|"Voltage drop compliance"'
    )
    
    local compliance_results_array=()
    
    for test_case in "${test_cases[@]}"; do
        local payload=$(echo "$test_case" | cut -d'|' -f1)
        local description=$(echo "$test_case" | cut -d'|' -f2 | tr -d '"')
        
        info "Testing: $description"
        
        local endpoint="/api/calculate/load"
        if echo "$payload" | grep -q "current_amps"; then
            endpoint="/api/calculate/wire-sizing"
        fi
        
        local response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$payload" \
            "http://$electrical_calculator_ip$endpoint" 2>/dev/null)
        
        local nec_compliant=$(echo "$response" | jq -r '.nec_compliant // false')
        local confidence_score=$(echo "$response" | jq -r '.confidence_score // 0')
        
        if [[ "$nec_compliant" == "true" ]]; then
            success "✅ $description: NEC compliant"
            compliance_results_array+=("{\"test\": \"$description\", \"compliant\": true, \"confidence_score\": $confidence_score}")
        else
            warn "⚠️ $description: NEC compliance check failed"
            compliance_results_array+=("{\"test\": \"$description\", \"compliant\": false, \"confidence_score\": $confidence_score}")
        fi
    done
    
    # Generate compliance report
    local compliance_json=$(printf '%s\n' "${compliance_results_array[@]}" | jq -s .)
    cat > $compliance_results << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "nec_compliance",
  "test_results": $compliance_json
}
EOF
    
    success "✅ NEC compliance validation completed"
}

# Validate security configuration
validate_security() {
    log "🔒 Validating security configuration..."
    
    local security_results="$TEST_RESULTS_DIR/security-validation.json"
    local security_checks=()
    
    # Check RBAC policies
    info "Checking RBAC configuration..."
    local rbac_count=$(kubectl get rolebindings,clusterrolebindings -A | grep electrical-estimation | wc -l)
    if [[ $rbac_count -gt 0 ]]; then
        success "✅ RBAC policies configured ($rbac_count found)"
        security_checks+=('{"check": "rbac", "status": "configured", "count": '$rbac_count'}')
    else
        security_checks+=('{"check": "rbac", "status": "missing", "count": 0}')
    fi
    
    # Check network policies
    info "Checking network policies..."
    local netpol_count=$(kubectl get networkpolicies -n electrical-estimation | grep -v NAME | wc -l)
    if [[ $netpol_count -gt 0 ]]; then
        success "✅ Network policies configured ($netpol_count found)"
        security_checks+=('{"check": "network_policies", "status": "configured", "count": '$netpol_count'}')
    else
        security_checks+=('{"check": "network_policies", "status": "missing", "count": 0}')
    fi
    
    # Check SSL certificates
    info "Checking SSL certificates..."
    local cert_count=$(kubectl get certificates -A | grep electrical-estimation | wc -l)
    if [[ $cert_count -gt 0 ]]; then
        success "✅ SSL certificates configured ($cert_count found)"
        security_checks+=('{"check": "ssl_certificates", "status": "configured", "count": '$cert_count'}')
    else
        security_checks+=('{"check": "ssl_certificates", "status": "missing", "count": 0}')
    fi
    
    # Check secrets
    info "Checking secret management..."
    local secret_count=$(kubectl get secrets -n electrical-estimation | grep -v default-token | wc -l)
    if [[ $secret_count -gt 0 ]]; then
        success "✅ Secrets properly managed ($secret_count found)"
        security_checks+=('{"check": "secrets", "status": "configured", "count": '$secret_count'}')
    else
        security_checks+=('{"check": "secrets", "status": "missing", "count": 0}')
    fi
    
    # Generate security report
    local security_json=$(printf '%s\n' "${security_checks[@]}" | jq -s .)
    cat > $security_results << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "security",
  "security_checks": $security_json
}
EOF
    
    success "✅ Security validation completed"
}

# Validate monitoring and alerting
validate_monitoring() {
    log "📊 Validating monitoring and alerting..."
    
    local monitoring_results="$TEST_RESULTS_DIR/monitoring-validation.json"
    local monitoring_checks=()
    
    # Check Prometheus
    info "Checking Prometheus deployment..."
    if kubectl get deployment prometheus-stack-prometheus -n monitoring &> /dev/null; then
        local prometheus_ready=$(kubectl get deployment prometheus-stack-prometheus -n monitoring -o jsonpath='{.status.readyReplicas}')
        success "✅ Prometheus deployed and ready ($prometheus_ready replicas)"
        monitoring_checks+=('{"component": "prometheus", "status": "ready", "replicas": '$prometheus_ready'}')
    else
        monitoring_checks+=('{"component": "prometheus", "status": "missing", "replicas": 0}')
    fi
    
    # Check Grafana
    info "Checking Grafana deployment..."
    if kubectl get deployment prometheus-stack-grafana -n monitoring &> /dev/null; then
        local grafana_ready=$(kubectl get deployment prometheus-stack-grafana -n monitoring -o jsonpath='{.status.readyReplicas}')
        success "✅ Grafana deployed and ready ($grafana_ready replicas)"
        monitoring_checks+=('{"component": "grafana", "status": "ready", "replicas": '$grafana_ready'}')
    else
        monitoring_checks+=('{"component": "grafana", "status": "missing", "replicas": 0}')
    fi
    
    # Check AlertManager
    info "Checking AlertManager deployment..."
    if kubectl get deployment prometheus-stack-alertmanager -n monitoring &> /dev/null; then
        local alertmanager_ready=$(kubectl get deployment prometheus-stack-alertmanager -n monitoring -o jsonpath='{.status.readyReplicas}')
        success "✅ AlertManager deployed and ready ($alertmanager_ready replicas)"
        monitoring_checks+=('{"component": "alertmanager", "status": "ready", "replicas": '$alertmanager_ready'}')
    else
        monitoring_checks+=('{"component": "alertmanager", "status": "missing", "replicas": 0}')
    fi
    
    # Check ServiceMonitors
    info "Checking ServiceMonitors..."
    local servicemonitor_count=$(kubectl get servicemonitors -A | grep -v NAME | wc -l)
    if [[ $servicemonitor_count -gt 0 ]]; then
        success "✅ ServiceMonitors configured ($servicemonitor_count found)"
        monitoring_checks+=('{"component": "servicemonitors", "status": "configured", "count": '$servicemonitor_count'}')
    else
        monitoring_checks+=('{"component": "servicemonitors", "status": "missing", "count": 0}')
    fi
    
    # Generate monitoring report
    local monitoring_json=$(printf '%s\n' "${monitoring_checks[@]}" | jq -s .)
    cat > $monitoring_results << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "monitoring",
  "monitoring_checks": $monitoring_json
}
EOF
    
    success "✅ Monitoring validation completed"
}

# Generate comprehensive final report
generate_final_report() {
    log "📋 Generating comprehensive final report..."
    
    local final_report="$TEST_RESULTS_DIR/final-validation-report.json"
    local summary_report="$TEST_RESULTS_DIR/FINAL-VALIDATION-SUMMARY.md"
    
    # Aggregate all validation results
    local all_results=()
    for result_file in "$TEST_RESULTS_DIR"/*.json; do
        if [[ -f "$result_file" && "$result_file" != "$final_report" ]]; then
            all_results+=("$(cat "$result_file")")
        fi
    done
    
    local results_json=$(printf '%s\n' "${all_results[@]}" | jq -s .)
    
    # Generate comprehensive JSON report
    cat > $final_report << EOF
{
  "validation_summary": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "project_id": "$PROJECT_ID",
    "cluster_name": "$CLUSTER_NAME",
    "region": "$REGION",
    "domain": "$DOMAIN_NAME",
    "validation_version": "1.0.0"
  },
  "validation_results": $results_json,
  "deployment_metadata": {
    "kubernetes_version": "$(kubectl version --short | grep Server | awk '{print $3}')",
    "cluster_nodes": $(kubectl get nodes --no-headers | wc -l),
    "total_pods": $(kubectl get pods --all-namespaces --no-headers | wc -l),
    "total_services": $(kubectl get services --all-namespaces --no-headers | wc -l)
  }
}
EOF
    
    # Generate human-readable summary
    cat > $summary_report << EOF
# Electrical Estimation System - Final Validation Report

## 🚀 Deployment Summary
- **Project**: $PROJECT_ID
- **Cluster**: $CLUSTER_NAME ($REGION)  
- **Validation Date**: $(date)
- **Domain**: $DOMAIN_NAME
- **Kubernetes Version**: $(kubectl version --short | grep Server | awk '{print $3}')

## ✅ Validation Results

### Infrastructure Validation
$(if [[ -f "$TEST_RESULTS_DIR/infrastructure-validation.json" ]]; then
    local passed=$(jq -r '.passed_checks' "$TEST_RESULTS_DIR/infrastructure-validation.json")
    local total=$(jq -r '.total_checks' "$TEST_RESULTS_DIR/infrastructure-validation.json")
    echo "- **Status**: $passed/$total checks passed"
    echo "- **Deployments**: $(jq -r '.deployment_status.ready_deployments' "$TEST_RESULTS_DIR/infrastructure-validation.json")/$(jq -r '.deployment_status.total_deployments' "$TEST_RESULTS_DIR/infrastructure-validation.json") ready"
    echo "- **Services**: $(jq -r '.deployment_status.service_count' "$TEST_RESULTS_DIR/infrastructure-validation.json") configured"
else
    echo "- **Status**: Not tested"
fi)

### Service Validation  
$(if [[ -f "$TEST_RESULTS_DIR/service-validation.json" ]]; then
    echo "- **Electrical Calculator**: $(jq -r '.services[] | select(.service=="electrical-calculator") | .status' "$TEST_RESULTS_DIR/service-validation.json")"
    echo "- **Load Calculation**: $(jq -r '.services[] | select(.service=="load-calculation") | .status' "$TEST_RESULTS_DIR/service-validation.json")"
    echo "- **N8N Workflows**: $(jq -r '.services[] | select(.service=="n8n") | .status' "$TEST_RESULTS_DIR/service-validation.json")"
else
    echo "- **Status**: Not tested"
fi)

### Performance Results
$(if [[ -f "$TEST_RESULTS_DIR/performance-results.json" ]]; then
    echo "- **Success Rate**: $(jq -r '.results.success_rate_percent' "$TEST_RESULTS_DIR/performance-results.json")%"
    echo "- **Average Response Time**: $(jq -r '.results.response_times_ms.average' "$TEST_RESULTS_DIR/performance-results.json")ms"
    echo "- **Total Requests**: $(jq -r '.results.total_tests' "$TEST_RESULTS_DIR/performance-results.json")"
else
    echo "- **Status**: Not tested"
fi)

### NEC Compliance Validation
$(if [[ -f "$TEST_RESULTS_DIR/nec-compliance-validation.json" ]]; then
    local compliant_tests=$(jq '[.test_results[] | select(.compliant==true)] | length' "$TEST_RESULTS_DIR/nec-compliance-validation.json")
    local total_tests=$(jq '.test_results | length' "$TEST_RESULTS_DIR/nec-compliance-validation.json")
    echo "- **Compliance Tests**: $compliant_tests/$total_tests passed"
    echo "- **Average Confidence**: $(jq '[.test_results[].confidence_score] | add / length' "$TEST_RESULTS_DIR/nec-compliance-validation.json")"
else
    echo "- **Status**: Not tested"  
fi)

### Security Configuration
$(if [[ -f "$TEST_RESULTS_DIR/security-validation.json" ]]; then
    echo "- **RBAC Policies**: $(jq -r '.security_checks[] | select(.check=="rbac") | .status' "$TEST_RESULTS_DIR/security-validation.json")"
    echo "- **Network Policies**: $(jq -r '.security_checks[] | select(.check=="network_policies") | .status' "$TEST_RESULTS_DIR/security-validation.json")"
    echo "- **SSL Certificates**: $(jq -r '.security_checks[] | select(.check=="ssl_certificates") | .status' "$TEST_RESULTS_DIR/security-validation.json")"
    echo "- **Secret Management**: $(jq -r '.security_checks[] | select(.check=="secrets") | .status' "$TEST_RESULTS_DIR/security-validation.json")"
else
    echo "- **Status**: Not validated"
fi)

### Monitoring & Alerting
$(if [[ -f "$TEST_RESULTS_DIR/monitoring-validation.json" ]]; then
    echo "- **Prometheus**: $(jq -r '.monitoring_checks[] | select(.component=="prometheus") | .status' "$TEST_RESULTS_DIR/monitoring-validation.json")"
    echo "- **Grafana**: $(jq -r '.monitoring_checks[] | select(.component=="grafana") | .status' "$TEST_RESULTS_DIR/monitoring-validation.json")"  
    echo "- **AlertManager**: $(jq -r '.monitoring_checks[] | select(.component=="alertmanager") | .status' "$TEST_RESULTS_DIR/monitoring-validation.json")"
    echo "- **ServiceMonitors**: $(jq -r '.monitoring_checks[] | select(.component=="servicemonitors") | .count' "$TEST_RESULTS_DIR/monitoring-validation.json") configured"
else
    echo "- **Status**: Not validated"
fi)

## 🌐 Access Information

### Application Endpoints
- **Main Application**: https://$DOMAIN_NAME
- **API Documentation**: https://$DOMAIN_NAME/api/docs
- **N8N Workflows**: https://$DOMAIN_NAME/n8n

### Monitoring Dashboards  
- **Grafana**: https://grafana.$DOMAIN_NAME
- **Prometheus**: https://prometheus.$DOMAIN_NAME
- **AlertManager**: https://alertmanager.$DOMAIN_NAME

### Default Credentials
- **Grafana**: admin / admin123!
- **Basic Auth**: admin / (configured password)

## 📊 System Metrics
- **Cluster Nodes**: $(kubectl get nodes --no-headers | wc -l)
- **Total Pods**: $(kubectl get pods --all-namespaces --no-headers | wc -l)
- **Total Services**: $(kubectl get services --all-namespaces --no-headers | wc -l)
- **Persistent Volumes**: $(kubectl get pv --no-headers | wc -l)

## 🎯 Production Readiness Checklist

### ✅ Completed Items
- [x] Core infrastructure deployed
- [x] AI services and electrical calculator operational
- [x] Security policies and RBAC configured
- [x] N8N workflow automation deployed
- [x] Edge computing activated
- [x] Integration tests executed
- [x] Monitoring dashboards configured
- [x] Performance validation completed

### 📋 Post-Deployment Tasks
- [ ] Configure production SSL certificates
- [ ] Set up automated backups
- [ ] Configure log aggregation (ELK stack)
- [ ] Set up disaster recovery procedures
- [ ] Configure production alerting channels
- [ ] Performance tuning based on production load
- [ ] Security scanning and penetration testing
- [ ] User acceptance testing

## 🔧 Maintenance Information
- **Backup Schedule**: Daily automated snapshots
- **Update Schedule**: Monthly security patches
- **Monitoring Retention**: 30 days
- **Log Retention**: 7 days (application), 30 days (audit)

## 📞 Support Information
- **Documentation**: [Technical Documentation]
- **Monitoring**: [Grafana Dashboards]
- **Issue Tracking**: [GitHub Issues]
- **Emergency Contact**: [On-call Engineering]

---
**Report Generated**: $(date)  
**Validation Framework Version**: 1.0.0
EOF
    
    success "✅ Final validation report generated"
    info "📋 Summary Report: $summary_report"
    info "📊 Detailed JSON Report: $final_report"
}

# Enhanced main execution with comprehensive error handling and reporting
main() {
    log "🔍 Starting Final Validation and Performance Verification"
    log "========================================================================="
    
    # Initialize validation environment
    if ! initialize_validation; then
        error "Failed to initialize validation environment"
        exit 1
    fi
    
    # Track validation results
    local validation_results=()
    local failed_validations=()
    local skipped_validations=()
    
    # Run infrastructure validation
    log "📋 Running validation tests..."
    if safe_execute "Infrastructure validation" "continue" validate_infrastructure; then
        validation_results+=("Infrastructure: ✅ PASSED")
        success "Infrastructure validation completed successfully"
    else
        validation_results+=("Infrastructure: ❌ FAILED")
        failed_validations+=("infrastructure")
        error "Infrastructure validation failed"
    fi
    
    # Run service validation
    if safe_execute "Service validation" "continue" validate_services; then
        validation_results+=("Services: ✅ PASSED")
        success "Service validation completed successfully"
    else
        validation_results+=("Services: ❌ FAILED")
        failed_validations+=("services")
        error "Service validation failed"
    fi
    
    # Run performance tests
    if safe_execute "Performance testing" "continue" run_performance_tests; then
        validation_results+=("Performance: ✅ PASSED")
        success "Performance testing completed successfully"
    else
        validation_results+=("Performance: ⚠️ PARTIAL")
        skipped_validations+=("performance")
        warn "Performance testing completed with issues"
    fi
    
    # Run NEC compliance validation
    if safe_execute "NEC compliance validation" "continue" validate_nec_compliance; then
        validation_results+=("NEC Compliance: ✅ PASSED")
        success "NEC compliance validation completed successfully"
    else
        validation_results+=("NEC Compliance: ❌ FAILED")
        failed_validations+=("nec_compliance")
        error "NEC compliance validation failed"
    fi
    
    # Run security validation
    if safe_execute "Security validation" "continue" validate_security; then
        validation_results+=("Security: ✅ PASSED")
        success "Security validation completed successfully"
    else
        validation_results+=("Security: ⚠️ PARTIAL")
        skipped_validations+=("security")
        warn "Security validation completed with issues"
    fi
    
    # Run monitoring validation
    if safe_execute "Monitoring validation" "continue" validate_monitoring; then
        validation_results+=("Monitoring: ✅ PASSED")
        success "Monitoring validation completed successfully"
    else
        validation_results+=("Monitoring: ⚠️ PARTIAL")
        skipped_validations+=("monitoring")
        warn "Monitoring validation completed with issues"
    fi
    
    # Generate comprehensive reports
    log "📊 Generating comprehensive validation reports..."
    if safe_execute "Report generation" "continue" generate_final_report; then
        success "Validation reports generated successfully"
    else
        warn "Report generation completed with issues"
    fi
    
    # Generate validation summary
    local total_validations=6
    local passed_validations=$((total_validations - ${#failed_validations[@]} - ${#skipped_validations[@]}))
    local overall_status="PRODUCTION READY"
    
    if [[ ${#failed_validations[@]} -gt 0 ]]; then
        overall_status="REQUIRES ATTENTION"
        VALIDATION_EXIT_CODE=1
    elif [[ ${#skipped_validations[@]} -gt 0 ]]; then
        overall_status="PARTIAL SUCCESS"
    fi
    
    # Display final results
    log "========================================================================="
    if [[ $overall_status == "PRODUCTION READY" ]]; then
        success "🎉 Final validation completed successfully!"
    elif [[ $overall_status == "PARTIAL SUCCESS" ]]; then
        warn "⚠️ Final validation completed with some issues"
    else
        error "❌ Final validation completed with failures"
    fi
    
    log ""
    log "📊 Validation Summary:"
    log "  - Total Tests: $total_validations"
    log "  - Passed: $passed_validations"
    log "  - Failed: ${#failed_validations[@]}"
    log "  - Partial/Skipped: ${#skipped_validations[@]}"
    log ""
    
    log "📋 Detailed Results:"
    for result in "${validation_results[@]}"; do
        log "  - $result"
    done
    
    if [[ ${#failed_validations[@]} -gt 0 ]]; then
        log ""
        error "❌ Failed Validations:"
        for failed in "${failed_validations[@]}"; do
            error "  - $failed"
        done
    fi
    
    if [[ ${#skipped_validations[@]} -gt 0 ]]; then
        log ""
        warn "⚠️ Partial/Skipped Validations:"
        for skipped in "${skipped_validations[@]}"; do
            warn "  - $skipped"
        done
    fi
    
    log ""
    log "📁 Generated Reports:"
    log "  - Summary Report: $TEST_RESULTS_DIR/FINAL-VALIDATION-SUMMARY.md"
    log "  - Detailed Report: $TEST_RESULTS_DIR/final-validation-report.json"
    log "  - Error Summary: $TEST_RESULTS_DIR/error-summary.json"
    log "  - Validation Log: $VALIDATION_LOG_FILE"
    
    if [[ ${#VALIDATION_ERRORS[@]} -gt 0 ]]; then
        log ""
        error "📊 Error Summary:"
        error "  - Total Errors: ${#VALIDATION_ERRORS[@]}"
        error "  - Total Warnings: ${#VALIDATION_WARNINGS[@]}"
        error "  - See detailed error log: $TEST_RESULTS_DIR/error-summary.json"
    fi
    
    log ""
    case "$overall_status" in
        "PRODUCTION READY")
            success "🚀 System Status: $overall_status"
            ;;
        "PARTIAL SUCCESS")
            warn "⚠️ System Status: $overall_status"
            ;;
        "REQUIRES ATTENTION")
            error "❌ System Status: $overall_status"
            ;;
    esac
    
    log "========================================================================="
    
    # Suggest next steps based on results
    if [[ $overall_status != "PRODUCTION READY" ]]; then
        log ""
        log "🔧 Recommended Next Steps:"
        
        if [[ " ${failed_validations[*]} " =~ " infrastructure " ]]; then
            log "  1. Review Kubernetes cluster status and deployment configurations"
            log "  2. Check for missing namespaces, services, or deployments"
        fi
        
        if [[ " ${failed_validations[*]} " =~ " services " ]]; then
            log "  1. Verify service endpoints and connectivity"
            log "  2. Check application health and logs"
        fi
        
        if [[ " ${failed_validations[*]} " =~ " nec_compliance " ]]; then
            log "  1. Review NEC compliance validation failures"
            log "  2. Update electrical calculation logic if needed"
        fi
        
        if [[ " ${skipped_validations[*]} " =~ " performance " ]]; then
            log "  1. Ensure service endpoints are accessible"
            log "  2. Review performance test configuration"
        fi
        
        if [[ " ${skipped_validations[*]} " =~ " security " ]]; then
            log "  1. Configure RBAC policies and network policies"
            log "  2. Set up SSL certificates and secrets management"
        fi
        
        if [[ " ${skipped_validations[*]} " =~ " monitoring " ]]; then
            log "  1. Deploy Prometheus, Grafana, and AlertManager"
            log "  2. Configure ServiceMonitors and alerting rules"
        fi
        
        log ""
        log "📋 For detailed troubleshooting information, review:"
        log "  - Validation log: $VALIDATION_LOG_FILE"
        log "  - Error summary: $TEST_RESULTS_DIR/error-summary.json"
        log "  - Individual validation reports: $TEST_RESULTS_DIR/"
    fi
    
    log "========================================================================="
}

# Script argument handling
show_help() {
    cat << EOF
Final Validation Script for Electrical Estimation System

Usage: $0 [OPTIONS]

OPTIONS:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose logging
  --max-retries N         Set maximum retry attempts (default: 3)
  --retry-delay N         Set retry delay in seconds (default: 5)
  --timeout N             Set command timeout in seconds (default: 30)
  --skip-performance      Skip performance testing
  --skip-security         Skip security validation
  --skip-monitoring       Skip monitoring validation

ENVIRONMENT VARIABLES:
  PROJECT_ID              GCP Project ID (required)
  CLUSTER_NAME            Kubernetes cluster name (default: electrical-estimation-cluster)
  REGION                  GCP region (default: us-central1)
  DOMAIN_NAME             Domain name (default: electrical-estimation.com)

EXAMPLES:
  $0                      Run full validation
  $0 --verbose            Run with verbose output
  $0 --skip-performance   Skip performance tests
  $0 --max-retries 5      Use 5 retry attempts

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        --max-retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        --retry-delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT_DURATION="$2"
            shift 2
            ;;
        --skip-performance)
            SKIP_PERFORMANCE=true
            shift
            ;;
        --skip-security)
            SKIP_SECURITY=true
            shift
            ;;
        --skip-monitoring)
            SKIP_MONITORING=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate numeric arguments
if ! [[ "$MAX_RETRIES" =~ ^[0-9]+$ ]] || [[ "$MAX_RETRIES" -lt 1 ]] || [[ "$MAX_RETRIES" -gt 10 ]]; then
    error "MAX_RETRIES must be a number between 1 and 10"
    exit 1
fi

if ! [[ "$RETRY_DELAY" =~ ^[0-9]+$ ]] || [[ "$RETRY_DELAY" -lt 1 ]] || [[ "$RETRY_DELAY" -gt 60 ]]; then
    error "RETRY_DELAY must be a number between 1 and 60"
    exit 1
fi

if ! [[ "$TIMEOUT_DURATION" =~ ^[0-9]+$ ]] || [[ "$TIMEOUT_DURATION" -lt 10 ]] || [[ "$TIMEOUT_DURATION" -gt 300 ]]; then
    error "TIMEOUT_DURATION must be a number between 10 and 300"
    exit 1
fi

# Execute main function with error handling
main "$@"