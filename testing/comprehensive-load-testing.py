#!/usr/bin/env python3
"""
Comprehensive Load Testing Framework for Electrical Estimation System
Tests system performance under realistic electrical contracting workloads
"""

import asyncio
import aiohttp
import json
import time
import random
import statistics
import numpy as np
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import yaml
import uuid
import websockets
import threading
import queue
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class LoadTestConfig:
    """Configuration for load testing scenarios"""
    base_url: str = "http://localhost:3001"
    websocket_url: str = "ws://localhost:3001/ws"
    
    # Test duration and scaling
    test_duration_seconds: int = 300        # 5 minutes
    ramp_up_seconds: int = 60               # 1 minute ramp up
    ramp_down_seconds: int = 60             # 1 minute ramp down
    
    # User simulation
    max_concurrent_users: int = 1000        # Peak concurrent users
    min_concurrent_users: int = 10          # Baseline users
    user_think_time_seconds: Tuple[float, float] = (1.0, 5.0)  # Min/max think time
    
    # Performance targets
    target_avg_response_time_ms: float = 200.0
    target_95th_percentile_ms: float = 500.0
    target_error_rate_percent: float = 1.0
    target_throughput_rps: float = 500.0
    
    # Test scenarios
    scenario_weights: Dict[str, float] = None
    
    def __post_init__(self):
        if self.scenario_weights is None:
            self.scenario_weights = {
                'electrical_calculation': 0.40,  # 40% of traffic
                'material_lookup': 0.25,         # 25% of traffic
                'nec_compliance_check': 0.15,    # 15% of traffic
                'project_estimation': 0.10,      # 10% of traffic
                'report_generation': 0.05,       # 5% of traffic
                'monday_integration': 0.05       # 5% of traffic
            }

@dataclass
class TestScenario:
    """Individual test scenario definition"""
    name: str
    endpoint: str
    method: str
    payload: Dict[str, Any]
    expected_response_time_ms: float
    weight: float
    requires_auth: bool = True
    
@dataclass
class RequestResult:
    """Result of a single request"""
    scenario_name: str
    start_time: datetime
    end_time: datetime
    response_time_ms: float
    status_code: int
    success: bool
    error_message: Optional[str] = None
    response_size_bytes: int = 0

@dataclass
class LoadTestResults:
    """Comprehensive load test results"""
    test_name: str
    start_time: datetime
    end_time: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    
    # Performance metrics
    avg_response_time_ms: float
    median_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    
    # Throughput metrics
    total_throughput_rps: float
    peak_throughput_rps: float
    
    # Error metrics
    error_rate_percent: float
    errors_by_type: Dict[str, int]
    
    # Resource utilization (if available)
    peak_cpu_percent: Optional[float] = None
    peak_memory_mb: Optional[float] = None
    
    # Scenario-specific results
    scenario_results: Dict[str, Any] = None

class ElectricalTestScenarios:
    """Realistic test scenarios for electrical estimation system"""
    
    @staticmethod
    def get_electrical_calculation_scenarios() -> List[TestScenario]:
        """Load calculation scenarios"""
        scenarios = []
        
        # Residential load calculations
        for i in range(5):
            area = random.randint(800, 5000)
            scenarios.append(TestScenario(
                name=f"residential_load_calc_{i}",
                endpoint="/api/calculations/load",
                method="POST",
                payload={
                    "calculation_type": "load_calculation",
                    "building_type": "residential",
                    "area_sqft": area,
                    "voltage_system": "240V_single_phase",
                    "appliance_load": random.randint(3000, 8000),
                    "lighting_load": random.randint(2000, 5000)
                },
                expected_response_time_ms=50.0,
                weight=0.6
            ))
        
        # Commercial load calculations
        for i in range(3):
            area = random.randint(2000, 20000)
            scenarios.append(TestScenario(
                name=f"commercial_load_calc_{i}",
                endpoint="/api/calculations/load",
                method="POST",
                payload={
                    "calculation_type": "load_calculation",
                    "building_type": "commercial",
                    "area_sqft": area,
                    "voltage_system": "208V_3phase",
                    "appliance_load": random.randint(10000, 50000),
                    "lighting_load": random.randint(5000, 15000)
                },
                expected_response_time_ms=75.0,
                weight=0.4
            ))
        
        # Wire sizing calculations
        for i in range(4):
            scenarios.append(TestScenario(
                name=f"wire_sizing_{i}",
                endpoint="/api/calculations/wire-sizing",
                method="POST",
                payload={
                    "calculation_type": "wire_sizing",
                    "current_amps": random.randint(15, 200),
                    "distance_feet": random.randint(50, 500),
                    "voltage_system": random.choice(["120V", "240V", "208V_3phase"]),
                    "conductor_material": random.choice(["copper", "aluminum"]),
                    "conduit_type": random.choice(["EMT", "PVC", "rigid"])
                },
                expected_response_time_ms=30.0,
                weight=0.3
            ))
        
        return scenarios
    
    @staticmethod
    def get_material_lookup_scenarios() -> List[TestScenario]:
        """Material database lookup scenarios"""
        return [
            TestScenario(
                name="material_search_wire",
                endpoint="/api/materials/search",
                method="GET",
                payload={"q": "12 AWG copper wire", "category": "wire", "limit": 50},
                expected_response_time_ms=25.0,
                weight=0.4
            ),
            TestScenario(
                name="material_search_conduit",
                endpoint="/api/materials/search",
                method="GET",
                payload={"q": "EMT conduit", "category": "conduit", "limit": 30},
                expected_response_time_ms=20.0,
                weight=0.3
            ),
            TestScenario(
                name="material_pricing_bulk",
                endpoint="/api/materials/pricing",
                method="POST",
                payload={
                    "material_ids": [str(uuid.uuid4()) for _ in range(20)],
                    "region": "US_WEST",
                    "quantity_discounts": True
                },
                expected_response_time_ms=40.0,
                weight=0.3
            )
        ]
    
    @staticmethod
    def get_nec_compliance_scenarios() -> List[TestScenario]:
        """NEC compliance checking scenarios"""
        return [
            TestScenario(
                name="nec_branch_circuit_check",
                endpoint="/api/compliance/nec-check",
                method="POST",
                payload={
                    "calculation_data": {
                        "circuit_type": "branch_circuit",
                        "ampacity": 20,
                        "wire_size": "12_AWG",
                        "breaker_size": 20,
                        "load_type": "general_purpose",
                        "location": "dry"
                    },
                    "nec_version": "2023"
                },
                expected_response_time_ms=30.0,
                weight=0.5
            ),
            TestScenario(
                name="nec_panel_sizing_check",
                endpoint="/api/compliance/nec-check",
                method="POST",
                payload={
                    "calculation_data": {
                        "panel_type": "main_panel",
                        "service_size": 200,
                        "total_breaker_ampacity": 400,
                        "demand_load": 150,
                        "diversity_factor": 0.75
                    },
                    "nec_version": "2023"
                },
                expected_response_time_ms=45.0,
                weight=0.3
            ),
            TestScenario(
                name="nec_grounding_check",
                endpoint="/api/compliance/nec-check",
                method="POST",
                payload={
                    "calculation_data": {
                        "grounding_type": "equipment_grounding",
                        "service_size": 100,
                        "grounding_electrode_conductor": "4_AWG",
                        "bonding_jumper": "6_AWG"
                    },
                    "nec_version": "2023"
                },
                expected_response_time_ms=35.0,
                weight=0.2
            )
        ]
    
    @staticmethod
    def get_project_estimation_scenarios() -> List[TestScenario]:
        """Project estimation scenarios"""
        return [
            TestScenario(
                name="residential_whole_house_estimate",
                endpoint="/api/estimations/create",
                method="POST",
                payload={
                    "project_type": "residential_new_construction",
                    "square_footage": 2500,
                    "bedrooms": 4,
                    "bathrooms": 3,
                    "garage": True,
                    "basement": False,
                    "region": "US_MIDWEST",
                    "complexity_factor": 1.2
                },
                expected_response_time_ms=200.0,
                weight=0.4
            ),
            TestScenario(
                name="commercial_tenant_improvement",
                endpoint="/api/estimations/create",
                method="POST",
                payload={
                    "project_type": "commercial_tenant_improvement",
                    "square_footage": 5000,
                    "occupancy_type": "office",
                    "lighting_upgrade": True,
                    "power_upgrade": True,
                    "region": "US_WEST",
                    "complexity_factor": 1.5
                },
                expected_response_time_ms=300.0,
                weight=0.4
            ),
            TestScenario(
                name="industrial_panel_upgrade",
                endpoint="/api/estimations/create",
                method="POST",
                payload={
                    "project_type": "industrial_electrical_upgrade",
                    "equipment_count": 15,
                    "voltage_level": "480V_3phase",
                    "hazardous_location": True,
                    "downtime_requirements": "minimal",
                    "region": "US_SOUTH",
                    "complexity_factor": 2.0
                },
                expected_response_time_ms=400.0,
                weight=0.2
            )
        ]

class LoadTestEngine:
    """Advanced load testing engine for electrical estimation system"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results = []
        self.active_users = 0
        self.start_time = None
        self.end_time = None
        self.auth_token = None
        
        # Test scenarios
        self.scenarios = self._initialize_scenarios()
        
        # Performance monitoring
        self.throughput_samples = []
        self.response_time_samples = []
        self.error_samples = []
        
        # Async session management
        self.session = None
        
        logger.info(f"Load test engine initialized with {len(self.scenarios)} scenarios")
    
    def _initialize_scenarios(self) -> List[TestScenario]:
        """Initialize all test scenarios"""
        scenarios = []
        
        # Get scenarios from each category
        electrical_scenarios = ElectricalTestScenarios.get_electrical_calculation_scenarios()
        material_scenarios = ElectricalTestScenarios.get_material_lookup_scenarios()
        nec_scenarios = ElectricalTestScenarios.get_nec_compliance_scenarios()
        estimation_scenarios = ElectricalTestScenarios.get_project_estimation_scenarios()
        
        # Weight scenarios according to config
        for scenario in electrical_scenarios:
            scenario.weight *= self.config.scenario_weights.get('electrical_calculation', 0.4)
            scenarios.append(scenario)
        
        for scenario in material_scenarios:
            scenario.weight *= self.config.scenario_weights.get('material_lookup', 0.25)
            scenarios.append(scenario)
        
        for scenario in nec_scenarios:
            scenario.weight *= self.config.scenario_weights.get('nec_compliance_check', 0.15)
            scenarios.append(scenario)
        
        for scenario in estimation_scenarios:
            scenario.weight *= self.config.scenario_weights.get('project_estimation', 0.10)
            scenarios.append(scenario)
        
        return scenarios
    
    async def _get_auth_token(self) -> str:
        """Get authentication token for API requests"""
        try:
            async with aiohttp.ClientSession() as session:
                login_payload = {
                    "username": "load_test_user",
                    "password": "load_test_password"
                }
                
                async with session.post(
                    f"{self.config.base_url}/api/auth/login",
                    json=login_payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('token', '')
                    else:
                        logger.warning(f"Failed to get auth token: {response.status}")
                        return ""
        except Exception as e:
            logger.error(f"Auth token error: {e}")
            return ""
    
    def _select_scenario(self) -> TestScenario:
        """Select scenario based on weights"""
        weights = [s.weight for s in self.scenarios]
        return random.choices(self.scenarios, weights=weights)[0]
    
    async def _execute_request(self, scenario: TestScenario, user_id: int) -> RequestResult:
        """Execute a single request"""
        start_time = datetime.now()
        
        try:
            headers = {}
            if scenario.requires_auth and self.auth_token:
                headers['Authorization'] = f'Bearer {self.auth_token}'
                headers['Content-Type'] = 'application/json'
            
            if scenario.method == "GET":
                url = f"{self.config.base_url}{scenario.endpoint}"
                if scenario.payload:
                    # Convert payload to query parameters
                    params = '&'.join([f"{k}={v}" for k, v in scenario.payload.items()])
                    url = f"{url}?{params}"
                
                async with self.session.get(url, headers=headers) as response:
                    response_text = await response.text()
                    response_size = len(response_text.encode())
                    success = 200 <= response.status < 400
                    
            else:  # POST, PUT, etc.
                async with self.session.request(
                    scenario.method,
                    f"{self.config.base_url}{scenario.endpoint}",
                    json=scenario.payload,
                    headers=headers
                ) as response:
                    response_text = await response.text()
                    response_size = len(response_text.encode())
                    success = 200 <= response.status < 400
            
            end_time = datetime.now()
            response_time_ms = (end_time - start_time).total_seconds() * 1000
            
            return RequestResult(
                scenario_name=scenario.name,
                start_time=start_time,
                end_time=end_time,
                response_time_ms=response_time_ms,
                status_code=response.status,
                success=success,
                response_size_bytes=response_size,
                error_message=None if success else f"HTTP {response.status}"
            )
            
        except Exception as e:
            end_time = datetime.now()
            response_time_ms = (end_time - start_time).total_seconds() * 1000
            
            return RequestResult(
                scenario_name=scenario.name,
                start_time=start_time,
                end_time=end_time,
                response_time_ms=response_time_ms,
                status_code=0,
                success=False,
                error_message=str(e),
                response_size_bytes=0
            )
    
    async def _user_session(self, user_id: int, duration_seconds: float):
        """Simulate a single user session"""
        session_start = time.time()
        request_count = 0
        
        while (time.time() - session_start) < duration_seconds:
            # Select and execute scenario
            scenario = self._select_scenario()
            result = await self._execute_request(scenario, user_id)
            
            self.results.append(result)
            request_count += 1
            
            # Think time between requests
            think_time = random.uniform(*self.config.user_think_time_seconds)
            await asyncio.sleep(think_time)
        
        logger.debug(f"User {user_id} completed {request_count} requests")
    
    def _calculate_user_ramp(self, elapsed_seconds: float) -> int:
        """Calculate number of active users based on ramp profile"""
        total_duration = self.config.test_duration_seconds
        ramp_up = self.config.ramp_up_seconds
        ramp_down = self.config.ramp_down_seconds
        
        if elapsed_seconds <= ramp_up:
            # Ramp up phase
            progress = elapsed_seconds / ramp_up
            return int(self.config.min_concurrent_users + 
                      (self.config.max_concurrent_users - self.config.min_concurrent_users) * progress)
        
        elif elapsed_seconds >= (total_duration - ramp_down):
            # Ramp down phase
            remaining = total_duration - elapsed_seconds
            progress = remaining / ramp_down
            return int(self.config.min_concurrent_users + 
                      (self.config.max_concurrent_users - self.config.min_concurrent_users) * progress)
        
        else:
            # Steady state
            return self.config.max_concurrent_users
    
    async def _performance_monitor(self):
        """Monitor performance metrics during test"""
        while self.start_time and (not self.end_time):
            await asyncio.sleep(5)  # Sample every 5 seconds
            
            # Calculate current throughput
            recent_results = [
                r for r in self.results 
                if (datetime.now() - r.end_time).total_seconds() <= 5
            ]
            
            current_throughput = len(recent_results) / 5.0
            self.throughput_samples.append({
                'timestamp': datetime.now(),
                'throughput_rps': current_throughput,
                'active_users': self.active_users
            })
            
            # Sample response times
            if recent_results:
                avg_response_time = statistics.mean([r.response_time_ms for r in recent_results])
                error_rate = sum(1 for r in recent_results if not r.success) / len(recent_results) * 100
                
                self.response_time_samples.append({
                    'timestamp': datetime.now(),
                    'avg_response_time_ms': avg_response_time,
                    'error_rate_percent': error_rate
                })
            
            # Log current performance
            logger.info(f"Active users: {self.active_users}, "
                       f"Throughput: {current_throughput:.1f} RPS, "
                       f"Total requests: {len(self.results)}")
    
    async def run_load_test(self, test_name: str = "electrical_load_test") -> LoadTestResults:
        """Run comprehensive load test"""
        logger.info(f"Starting load test: {test_name}")
        
        # Initialize
        self.auth_token = await self._get_auth_token()
        self.start_time = datetime.now()
        
        # Create aiohttp session with connection pooling
        connector = aiohttp.TCPConnector(
            limit=1000,  # Total connection pool size
            limit_per_host=100,  # Connections per host
            ttl_dns_cache=300,  # DNS cache TTL
            use_dns_cache=True,
        )
        
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout
        )
        
        try:
            # Start performance monitoring
            monitor_task = asyncio.create_task(self._performance_monitor())
            
            # Main load test execution
            test_start_time = time.time()
            active_tasks = set()
            
            while (time.time() - test_start_time) < self.config.test_duration_seconds:
                elapsed = time.time() - test_start_time
                target_users = self._calculate_user_ramp(elapsed)
                
                # Adjust number of active users
                while len(active_tasks) < target_users:
                    user_id = len(active_tasks) + 1
                    remaining_time = self.config.test_duration_seconds - elapsed
                    
                    task = asyncio.create_task(
                        self._user_session(user_id, remaining_time)
                    )
                    active_tasks.add(task)
                
                # Remove completed tasks
                completed_tasks = [task for task in active_tasks if task.done()]
                for task in completed_tasks:
                    active_tasks.remove(task)
                
                self.active_users = len(active_tasks)
                
                # Small delay to prevent tight loop
                await asyncio.sleep(0.1)
            
            # Wait for remaining tasks to complete
            if active_tasks:
                await asyncio.gather(*active_tasks, return_exceptions=True)
            
            # Stop monitoring
            monitor_task.cancel()
            
        finally:
            await self.session.close()
        
        self.end_time = datetime.now()
        logger.info("Load test completed - analyzing results...")
        
        return self._analyze_results(test_name)
    
    def _analyze_results(self, test_name: str) -> LoadTestResults:
        """Analyze load test results"""
        if not self.results:
            raise ValueError("No results to analyze")
        
        # Basic metrics
        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if r.success)
        failed_requests = total_requests - successful_requests
        
        # Response time analysis
        response_times = [r.response_time_ms for r in self.results]
        avg_response_time = statistics.mean(response_times)
        median_response_time = statistics.median(response_times)
        
        # Percentiles
        p95_response_time = np.percentile(response_times, 95)
        p99_response_time = np.percentile(response_times, 99)
        min_response_time = min(response_times)
        max_response_time = max(response_times)
        
        # Throughput analysis
        test_duration = (self.end_time - self.start_time).total_seconds()
        total_throughput = total_requests / test_duration
        
        peak_throughput = 0
        if self.throughput_samples:
            peak_throughput = max(s['throughput_rps'] for s in self.throughput_samples)
        
        # Error analysis
        error_rate = (failed_requests / total_requests) * 100
        errors_by_type = {}
        for result in self.results:
            if not result.success:
                error_type = result.error_message or f"HTTP_{result.status_code}"
                errors_by_type[error_type] = errors_by_type.get(error_type, 0) + 1
        
        # Scenario-specific analysis
        scenario_results = {}
        scenarios_data = {}
        
        for result in self.results:
            if result.scenario_name not in scenarios_data:
                scenarios_data[result.scenario_name] = []
            scenarios_data[result.scenario_name].append(result)
        
        for scenario_name, scenario_data in scenarios_data.items():
            scenario_response_times = [r.response_time_ms for r in scenario_data]
            scenario_success_rate = sum(1 for r in scenario_data if r.success) / len(scenario_data) * 100
            
            scenario_results[scenario_name] = {
                'requests': len(scenario_data),
                'success_rate': scenario_success_rate,
                'avg_response_time_ms': statistics.mean(scenario_response_times),
                'p95_response_time_ms': np.percentile(scenario_response_times, 95)
            }
        
        return LoadTestResults(
            test_name=test_name,
            start_time=self.start_time,
            end_time=self.end_time,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time_ms=avg_response_time,
            median_response_time_ms=median_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min_response_time,
            max_response_time_ms=max_response_time,
            total_throughput_rps=total_throughput,
            peak_throughput_rps=peak_throughput,
            error_rate_percent=error_rate,
            errors_by_type=errors_by_type,
            scenario_results=scenario_results
        )
    
    def generate_report(self, results: LoadTestResults, output_dir: str = "load_test_reports"):
        """Generate comprehensive load test report"""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Create report timestamp
        timestamp = results.start_time.strftime("%Y%m%d_%H%M%S")
        
        # Generate JSON report
        json_report = asdict(results)
        json_report['start_time'] = results.start_time.isoformat()
        json_report['end_time'] = results.end_time.isoformat()
        
        json_path = output_path / f"{results.test_name}_{timestamp}.json"
        with open(json_path, 'w') as f:
            json.dump(json_report, f, indent=2, default=str)
        
        # Generate performance charts
        self._generate_performance_charts(results, output_path, timestamp)
        
        # Generate HTML report
        html_report = self._generate_html_report(results)
        html_path = output_path / f"{results.test_name}_{timestamp}.html"
        with open(html_path, 'w') as f:
            f.write(html_report)
        
        logger.info(f"Load test report generated: {html_path}")
        return html_path
    
    def _generate_performance_charts(self, results: LoadTestResults, output_path: Path, timestamp: str):
        """Generate performance visualization charts"""
        try:
            import matplotlib.pyplot as plt
            import seaborn as sns
            
            # Set style
            sns.set_style("whitegrid")
            
            # Response time distribution
            fig, axes = plt.subplots(2, 2, figsize=(15, 12))
            fig.suptitle(f'Load Test Performance - {results.test_name}', fontsize=16)
            
            # Response time histogram
            response_times = [r.response_time_ms for r in self.results]
            axes[0, 0].hist(response_times, bins=50, alpha=0.7, color='skyblue')
            axes[0, 0].axvline(results.avg_response_time_ms, color='red', linestyle='--', 
                              label=f'Avg: {results.avg_response_time_ms:.1f}ms')
            axes[0, 0].axvline(results.p95_response_time_ms, color='orange', linestyle='--', 
                              label=f'95th: {results.p95_response_time_ms:.1f}ms')
            axes[0, 0].set_xlabel('Response Time (ms)')
            axes[0, 0].set_ylabel('Frequency')
            axes[0, 0].set_title('Response Time Distribution')
            axes[0, 0].legend()
            
            # Throughput over time
            if self.throughput_samples:
                timestamps = [s['timestamp'] for s in self.throughput_samples]
                throughputs = [s['throughput_rps'] for s in self.throughput_samples]
                
                axes[0, 1].plot(timestamps, throughputs, color='green', linewidth=2)
                axes[0, 1].set_xlabel('Time')
                axes[0, 1].set_ylabel('Throughput (RPS)')
                axes[0, 1].set_title('Throughput Over Time')
                axes[0, 1].tick_params(axis='x', rotation=45)
            
            # Error rate over time
            if self.response_time_samples:
                timestamps = [s['timestamp'] for s in self.response_time_samples]
                error_rates = [s['error_rate_percent'] for s in self.response_time_samples]
                
                axes[1, 0].plot(timestamps, error_rates, color='red', linewidth=2)
                axes[1, 0].set_xlabel('Time')
                axes[1, 0].set_ylabel('Error Rate (%)')
                axes[1, 0].set_title('Error Rate Over Time')
                axes[1, 0].tick_params(axis='x', rotation=45)
            
            # Scenario performance comparison
            if results.scenario_results:
                scenario_names = list(results.scenario_results.keys())
                avg_times = [results.scenario_results[name]['avg_response_time_ms'] 
                           for name in scenario_names]
                
                bars = axes[1, 1].bar(range(len(scenario_names)), avg_times, 
                                     color='lightcoral', alpha=0.7)
                axes[1, 1].set_xlabel('Scenarios')
                axes[1, 1].set_ylabel('Avg Response Time (ms)')
                axes[1, 1].set_title('Scenario Performance Comparison')
                axes[1, 1].set_xticks(range(len(scenario_names)))
                axes[1, 1].set_xticklabels([name[:15] + '...' if len(name) > 15 else name 
                                           for name in scenario_names], rotation=45)
            
            plt.tight_layout()
            chart_path = output_path / f"performance_charts_{timestamp}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            
        except ImportError:
            logger.warning("Matplotlib not available - skipping chart generation")
        except Exception as e:
            logger.error(f"Chart generation error: {e}")
    
    def _generate_html_report(self, results: LoadTestResults) -> str:
        """Generate HTML report"""
        
        # Performance assessment
        performance_status = "PASS"
        issues = []
        
        if results.avg_response_time_ms > self.config.target_avg_response_time_ms:
            performance_status = "FAIL"
            issues.append(f"Average response time ({results.avg_response_time_ms:.1f}ms) exceeds target ({self.config.target_avg_response_time_ms}ms)")
        
        if results.p95_response_time_ms > self.config.target_95th_percentile_ms:
            performance_status = "FAIL" 
            issues.append(f"95th percentile response time ({results.p95_response_time_ms:.1f}ms) exceeds target ({self.config.target_95th_percentile_ms}ms)")
        
        if results.error_rate_percent > self.config.target_error_rate_percent:
            performance_status = "FAIL"
            issues.append(f"Error rate ({results.error_rate_percent:.2f}%) exceeds target ({self.config.target_error_rate_percent}%)")
        
        if results.total_throughput_rps < self.config.target_throughput_rps:
            performance_status = "FAIL"
            issues.append(f"Throughput ({results.total_throughput_rps:.1f} RPS) below target ({self.config.target_throughput_rps} RPS)")
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Load Test Report - {results.test_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f0f0f0; padding: 20px; border-radius: 5px; }}
                .status-pass {{ color: green; font-weight: bold; }}
                .status-fail {{ color: red; font-weight: bold; }}
                .metrics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
                .metric-card {{ border: 1px solid #ddd; padding: 15px; border-radius: 5px; }}
                .metric-value {{ font-size: 24px; font-weight: bold; color: #333; }}
                .metric-label {{ color: #666; font-size: 14px; }}
                .scenario-table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                .scenario-table th, .scenario-table td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                .scenario-table th {{ background-color: #f2f2f2; }}
                .issues {{ background-color: #ffe6e6; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Load Test Report: {results.test_name}</h1>
                <p><strong>Test Period:</strong> {results.start_time.strftime('%Y-%m-%d %H:%M:%S')} - {results.end_time.strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Duration:</strong> {(results.end_time - results.start_time).total_seconds():.0f} seconds</p>
                <p><strong>Overall Status:</strong> <span class="status-{'pass' if performance_status == 'PASS' else 'fail'}">{performance_status}</span></p>
            </div>
            
            {'<div class="issues"><h3>Performance Issues:</h3><ul>' + ''.join([f'<li>{issue}</li>' for issue in issues]) + '</ul></div>' if issues else ''}
            
            <h2>Key Metrics</h2>
            <div class="metrics">
                <div class="metric-card">
                    <div class="metric-value">{results.total_requests:,}</div>
                    <div class="metric-label">Total Requests</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{results.total_throughput_rps:.1f}</div>
                    <div class="metric-label">Throughput (RPS)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{results.avg_response_time_ms:.1f}ms</div>
                    <div class="metric-label">Avg Response Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{results.p95_response_time_ms:.1f}ms</div>
                    <div class="metric-label">95th Percentile</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{results.error_rate_percent:.2f}%</div>
                    <div class="metric-label">Error Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{results.peak_throughput_rps:.1f}</div>
                    <div class="metric-label">Peak Throughput</div>
                </div>
            </div>
            
            <h2>Response Time Breakdown</h2>
            <table class="scenario-table">
                <tr>
                    <th>Metric</th>
                    <th>Value (ms)</th>
                    <th>Target</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>Average</td>
                    <td>{results.avg_response_time_ms:.1f}</td>
                    <td>{self.config.target_avg_response_time_ms}</td>
                    <td class="status-{'pass' if results.avg_response_time_ms <= self.config.target_avg_response_time_ms else 'fail'}">{'PASS' if results.avg_response_time_ms <= self.config.target_avg_response_time_ms else 'FAIL'}</td>
                </tr>
                <tr>
                    <td>95th Percentile</td>
                    <td>{results.p95_response_time_ms:.1f}</td>
                    <td>{self.config.target_95th_percentile_ms}</td>
                    <td class="status-{'pass' if results.p95_response_time_ms <= self.config.target_95th_percentile_ms else 'fail'}">{'PASS' if results.p95_response_time_ms <= self.config.target_95th_percentile_ms else 'FAIL'}</td>
                </tr>
                <tr>
                    <td>99th Percentile</td>
                    <td>{results.p99_response_time_ms:.1f}</td>
                    <td>-</td>
                    <td>-</td>
                </tr>
                <tr>
                    <td>Maximum</td>
                    <td>{results.max_response_time_ms:.1f}</td>
                    <td>-</td>
                    <td>-</td>
                </tr>
            </table>
            
            <h2>Scenario Performance</h2>
            <table class="scenario-table">
                <tr>
                    <th>Scenario</th>
                    <th>Requests</th>
                    <th>Success Rate</th>
                    <th>Avg Response Time (ms)</th>
                    <th>95th Percentile (ms)</th>
                </tr>
        """
        
        if results.scenario_results:
            for scenario_name, scenario_data in results.scenario_results.items():
                html_content += f"""
                <tr>
                    <td>{scenario_name}</td>
                    <td>{scenario_data['requests']:,}</td>
                    <td>{scenario_data['success_rate']:.1f}%</td>
                    <td>{scenario_data['avg_response_time_ms']:.1f}</td>
                    <td>{scenario_data['p95_response_time_ms']:.1f}</td>
                </tr>
                """
        
        html_content += """
            </table>
            
            <h2>Error Summary</h2>
        """
        
        if results.errors_by_type:
            html_content += '<table class="scenario-table"><tr><th>Error Type</th><th>Count</th><th>Percentage</th></tr>'
            for error_type, count in results.errors_by_type.items():
                percentage = (count / results.total_requests) * 100
                html_content += f'<tr><td>{error_type}</td><td>{count:,}</td><td>{percentage:.2f}%</td></tr>'
            html_content += '</table>'
        else:
            html_content += '<p>No errors detected during the test.</p>'
        
        html_content += """
            </body>
            </html>
        """
        
        return html_content

async def main():
    """Run comprehensive load test suite"""
    
    # Configure load test
    config = LoadTestConfig(
        base_url="http://localhost:3001",
        test_duration_seconds=300,  # 5 minutes
        max_concurrent_users=200,
        min_concurrent_users=5,
        target_avg_response_time_ms=150.0,
        target_95th_percentile_ms=400.0,
        target_error_rate_percent=2.0,
        target_throughput_rps=300.0
    )
    
    # Initialize load test engine
    engine = LoadTestEngine(config)
    
    # Run load test
    logger.info("Starting comprehensive electrical estimation system load test...")
    results = await engine.run_load_test("electrical_system_comprehensive_test")
    
    # Generate report
    report_path = engine.generate_report(results)
    
    # Print summary
    print("\n" + "="*60)
    print("LOAD TEST RESULTS SUMMARY")
    print("="*60)
    print(f"Total Requests: {results.total_requests:,}")
    print(f"Successful Requests: {results.successful_requests:,}")
    print(f"Failed Requests: {results.failed_requests:,}")
    print(f"Success Rate: {(results.successful_requests/results.total_requests)*100:.2f}%")
    print(f"Average Response Time: {results.avg_response_time_ms:.1f}ms")
    print(f"95th Percentile: {results.p95_response_time_ms:.1f}ms")
    print(f"Throughput: {results.total_throughput_rps:.1f} RPS")
    print(f"Peak Throughput: {results.peak_throughput_rps:.1f} RPS")
    print(f"Error Rate: {results.error_rate_percent:.2f}%")
    print(f"\nDetailed report: {report_path}")
    
    # Performance assessment
    if (results.avg_response_time_ms <= config.target_avg_response_time_ms and
        results.p95_response_time_ms <= config.target_95th_percentile_ms and
        results.error_rate_percent <= config.target_error_rate_percent and
        results.total_throughput_rps >= config.target_throughput_rps):
        print("\n✅ PERFORMANCE TEST: PASSED")
        print("System meets all performance targets!")
    else:
        print("\n❌ PERFORMANCE TEST: FAILED")
        print("System does not meet performance targets - see report for details")

if __name__ == "__main__":
    asyncio.run(main())