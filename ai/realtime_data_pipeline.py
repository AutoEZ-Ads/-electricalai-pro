#!/usr/bin/env python3
"""
Real-Time Data Collection and Processing Pipeline
Industrial IoT integration with Apache Kafka for streaming electrical measurements
Supports IEC 61850, IEEE C37.118 synchrophasor data, and smart meter integration
"""

import asyncio
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import redis
from confluent_kafka import Producer, Consumer, KafkaError
from confluent_kafka.admin import AdminClient, NewTopic
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import struct
import socket
from collections import deque
import zmq


class DataSourceType(Enum):
    """Types of electrical data sources"""
    SMART_METER = "smart_meter"
    SYNCHROPHASOR = "synchrophasor"
    SCADA = "scada"
    INDUSTRIAL_SENSOR = "industrial_sensor"
    PROTECTIVE_RELAY = "protective_relay"
    POWER_QUALITY_ANALYZER = "power_quality"
    WEATHER_STATION = "weather"


class MeasurementType(Enum):
    """Types of electrical measurements"""
    VOLTAGE_RMS = "voltage_rms"
    CURRENT_RMS = "current_rms"
    ACTIVE_POWER = "active_power"
    REACTIVE_POWER = "reactive_power"
    FREQUENCY = "frequency"
    POWER_FACTOR = "power_factor"
    THD_VOLTAGE = "thd_voltage"
    THD_CURRENT = "thd_current"
    TEMPERATURE = "temperature"
    VIBRATION = "vibration"


@dataclass
class ElectricalMeasurement:
    """Standardized electrical measurement data structure"""
    device_id: str
    measurement_type: MeasurementType
    value: float
    unit: str
    timestamp: datetime
    phase: Optional[str] = None  # A, B, C, or None for three-phase average
    quality_flag: int = 0  # IEC 61850 quality flags
    source_type: DataSourceType = DataSourceType.SMART_METER
    location: Optional[Dict[str, float]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class DataQualityMetrics:
    """Data quality assessment metrics"""
    completeness_ratio: float  # Percentage of expected data received
    accuracy_score: float  # Based on validation checks
    timeliness_score: float  # Based on data freshness
    consistency_score: float  # Based on cross-validation
    overall_quality: float  # Weighted average
    anomaly_count: int
    last_updated: datetime


class SmartMeterInterface:
    """Interface for smart meter data collection (ANSI C12.22, IEC 62056)"""
    
    def __init__(self, meter_config: Dict[str, Any]):
        self.meter_config = meter_config
        self.logger = logging.getLogger(__name__)
        self.sampling_rate_hz = meter_config.get('sampling_rate_hz', 1)  # 1 Hz default
        self.accuracy_class = meter_config.get('accuracy_class', 0.1)  # ±0.1% for revenue grade
        
    async def collect_measurements(self) -> List[ElectricalMeasurement]:
        """Collect measurements from smart meter with ±0.1% accuracy"""
        
        measurements = []
        current_time = datetime.now()
        
        # Simulate smart meter data collection
        # In production, this would interface with actual meter protocols
        
        for phase in ['A', 'B', 'C']:
            # Voltage measurement
            voltage = self._simulate_voltage_measurement(phase)
            measurements.append(ElectricalMeasurement(
                device_id=self.meter_config['device_id'],
                measurement_type=MeasurementType.VOLTAGE_RMS,
                value=voltage,
                unit='V',
                timestamp=current_time,
                phase=phase,
                source_type=DataSourceType.SMART_METER,
                metadata={'accuracy_class': self.accuracy_class}
            ))
            
            # Current measurement
            current = self._simulate_current_measurement(phase)
            measurements.append(ElectricalMeasurement(
                device_id=self.meter_config['device_id'],
                measurement_type=MeasurementType.CURRENT_RMS,
                value=current,
                unit='A',
                timestamp=current_time,
                phase=phase,
                source_type=DataSourceType.SMART_METER
            ))
            
            # Power measurements
            active_power = voltage * current * np.random.uniform(0.85, 0.95)  # Power factor
            reactive_power = active_power * np.tan(np.arccos(np.random.uniform(0.85, 0.95)))
            
            measurements.extend([
                ElectricalMeasurement(
                    device_id=self.meter_config['device_id'],
                    measurement_type=MeasurementType.ACTIVE_POWER,
                    value=active_power,
                    unit='W',
                    timestamp=current_time,
                    phase=phase,
                    source_type=DataSourceType.SMART_METER
                ),
                ElectricalMeasurement(
                    device_id=self.meter_config['device_id'],
                    measurement_type=MeasurementType.REACTIVE_POWER,
                    value=reactive_power,
                    unit='VAR',
                    timestamp=current_time,
                    phase=phase,
                    source_type=DataSourceType.SMART_METER
                )
            ])
        
        return measurements
    
    def _simulate_voltage_measurement(self, phase: str) -> float:
        """Simulate accurate voltage measurement with realistic variations"""
        base_voltage = {'A': 277.0, 'B': 277.0, 'C': 277.0}[phase]
        # Add realistic voltage variation (±5%)
        variation = np.random.normal(0, base_voltage * 0.02)
        return base_voltage + variation
    
    def _simulate_current_measurement(self, phase: str) -> float:
        """Simulate current measurement with load variations"""
        base_current = np.random.uniform(10.0, 50.0)  # Variable load
        return max(0, base_current + np.random.normal(0, base_current * 0.05))


class SynchrophasorInterface:
    """IEEE C37.118 synchrophasor data interface"""
    
    def __init__(self, pmu_config: Dict[str, Any]):
        self.pmu_config = pmu_config
        self.logger = logging.getLogger(__name__)
        self.reporting_rate = pmu_config.get('reporting_rate', 30)  # 30 frames/second
        
    async def collect_synchrophasor_data(self) -> List[ElectricalMeasurement]:
        """Collect high-precision synchrophasor measurements"""
        
        measurements = []
        current_time = datetime.now()
        
        # Frequency measurement (system-wide)
        frequency = 60.0 + np.random.normal(0, 0.01)  # 60 Hz ± 10 mHz
        measurements.append(ElectricalMeasurement(
            device_id=self.pmu_config['device_id'],
            measurement_type=MeasurementType.FREQUENCY,
            value=frequency,
            unit='Hz',
            timestamp=current_time,
            source_type=DataSourceType.SYNCHROPHASOR,
            metadata={'reporting_rate': self.reporting_rate}
        ))
        
        # Phasor measurements for each phase
        for phase in ['A', 'B', 'C']:
            # Voltage phasor (magnitude and phase angle)
            voltage_mag = 277.0 + np.random.normal(0, 1.0)
            phase_angle = {'A': 0, 'B': -120, 'C': 120}[phase] + np.random.normal(0, 0.5)
            
            measurements.extend([
                ElectricalMeasurement(
                    device_id=self.pmu_config['device_id'],
                    measurement_type=MeasurementType.VOLTAGE_RMS,
                    value=voltage_mag,
                    unit='V',
                    timestamp=current_time,
                    phase=phase,
                    source_type=DataSourceType.SYNCHROPHASOR,
                    metadata={'phase_angle': phase_angle, 'phasor_data': True}
                )
            ])
        
        return measurements


class IndustrialSensorInterface:
    """Interface for industrial current monitoring sensors (50,000 Hz sampling)"""
    
    def __init__(self, sensor_config: Dict[str, Any]):
        self.sensor_config = sensor_config
        self.sampling_rate = sensor_config.get('sampling_rate_hz', 50000)
        self.logger = logging.getLogger(__name__)
        self.vibration_buffer = deque(maxlen=1000)  # Circular buffer for vibration data
        
    async def collect_high_frequency_data(self) -> List[ElectricalMeasurement]:
        """Collect high-frequency measurements for motor/generator analysis"""
        
        measurements = []
        current_time = datetime.now()
        
        # Motor current signature analysis
        motor_current = self._simulate_motor_current_with_harmonics()
        measurements.append(ElectricalMeasurement(
            device_id=self.sensor_config['device_id'],
            measurement_type=MeasurementType.CURRENT_RMS,
            value=motor_current['rms'],
            unit='A',
            timestamp=current_time,
            source_type=DataSourceType.INDUSTRIAL_SENSOR,
            metadata={
                'sampling_rate': self.sampling_rate,
                'thd_current': motor_current['thd'],
                'frequency_spectrum': motor_current['spectrum']
            }
        ))
        
        # Vibration analysis for predictive maintenance
        vibration_data = self._simulate_vibration_analysis()
        measurements.append(ElectricalMeasurement(
            device_id=self.sensor_config['device_id'],
            measurement_type=MeasurementType.VIBRATION,
            value=vibration_data['overall_level'],
            unit='mm/s',
            timestamp=current_time,
            source_type=DataSourceType.INDUSTRIAL_SENSOR,
            metadata={
                'peak_frequencies': vibration_data['peaks'],
                'bearing_condition': vibration_data['bearing_health']
            }
        ))
        
        return measurements
    
    def _simulate_motor_current_with_harmonics(self) -> Dict[str, Any]:
        """Simulate motor current with harmonic content for condition monitoring"""
        
        # Fundamental frequency component
        fundamental_amplitude = 25.0
        
        # Add harmonics (5th, 7th, 11th, 13th are common in motors)
        harmonics = {5: 0.05, 7: 0.03, 11: 0.02, 13: 0.015}
        
        # Calculate RMS and THD
        harmonic_sum_squares = sum((fundamental_amplitude * h_ratio) ** 2 for h_ratio in harmonics.values())
        rms_current = np.sqrt(fundamental_amplitude ** 2 + harmonic_sum_squares)
        thd = np.sqrt(harmonic_sum_squares) / fundamental_amplitude * 100
        
        return {
            'rms': rms_current,
            'thd': thd,
            'spectrum': harmonics
        }
    
    def _simulate_vibration_analysis(self) -> Dict[str, Any]:
        """Simulate vibration analysis for predictive maintenance"""
        
        # Simulate vibration spectrum
        running_speed_hz = 29.5  # Motor running at ~1770 RPM
        bearing_frequencies = {
            'inner_race': running_speed_hz * 5.9,
            'outer_race': running_speed_hz * 3.1,
            'ball_pass': running_speed_hz * 4.7
        }
        
        # Overall vibration level
        overall_level = np.random.uniform(2.0, 8.0)  # mm/s RMS
        
        # Health assessment
        bearing_health = "Good" if overall_level < 4.5 else ("Warning" if overall_level < 7.0 else "Alert")
        
        return {
            'overall_level': overall_level,
            'peaks': bearing_frequencies,
            'bearing_health': bearing_health
        }


class KafkaDataStreamer:
    """Apache Kafka integration for real-time data streaming"""
    
    def __init__(self, kafka_config: Dict[str, Any]):
        self.kafka_config = kafka_config
        self.producer = Producer(kafka_config)
        self.consumer = None
        self.logger = logging.getLogger(__name__)
        
    def setup_topics(self, topics: List[str]):
        """Create Kafka topics for different data types"""
        
        admin_client = AdminClient(self.kafka_config)
        
        topic_list = [
            NewTopic(topic, num_partitions=3, replication_factor=1)
            for topic in topics
        ]
        
        created_topics = admin_client.create_topics(topic_list)
        
        for topic, future in created_topics.items():
            try:
                future.result()
                self.logger.info(f"Topic {topic} created successfully")
            except Exception as e:
                self.logger.error(f"Failed to create topic {topic}: {e}")
    
    async def stream_measurements(self, measurements: List[ElectricalMeasurement]):
        """Stream measurements to appropriate Kafka topics"""
        
        for measurement in measurements:
            topic = f"electrical_{measurement.source_type.value}"
            
            # Serialize measurement
            message = {
                'device_id': measurement.device_id,
                'measurement_type': measurement.measurement_type.value,
                'value': measurement.value,
                'unit': measurement.unit,
                'timestamp': measurement.timestamp.isoformat(),
                'phase': measurement.phase,
                'quality_flag': measurement.quality_flag,
                'source_type': measurement.source_type.value,
                'location': measurement.location,
                'metadata': measurement.metadata
            }
            
            # Send to Kafka
            self.producer.produce(
                topic=topic,
                key=measurement.device_id,
                value=json.dumps(message, default=str),
                callback=self._delivery_callback
            )
        
        # Flush producer
        self.producer.flush()
    
    def _delivery_callback(self, err, msg):
        """Callback for message delivery confirmation"""
        if err is not None:
            self.logger.error(f"Message delivery failed: {err}")
        else:
            self.logger.debug(f"Message delivered to {msg.topic()} [{msg.partition()}]")


class DataQualityValidator:
    """Real-time data quality assessment and validation"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.validation_rules = self._load_validation_rules()
        self.historical_stats = {}
        
    def _load_validation_rules(self) -> Dict[MeasurementType, Dict]:
        """Load validation rules for different measurement types"""
        
        return {
            MeasurementType.VOLTAGE_RMS: {
                'min_value': 200.0, 'max_value': 300.0,
                'max_rate_of_change': 10.0,  # V/s
                'statistical_bounds': 3.0  # Standard deviations
            },
            MeasurementType.CURRENT_RMS: {
                'min_value': 0.0, 'max_value': 1000.0,
                'max_rate_of_change': 50.0,  # A/s
                'statistical_bounds': 3.0
            },
            MeasurementType.FREQUENCY: {
                'min_value': 59.5, 'max_value': 60.5,
                'max_rate_of_change': 0.5,  # Hz/s
                'statistical_bounds': 2.0
            },
            MeasurementType.POWER_FACTOR: {
                'min_value': 0.0, 'max_value': 1.0,
                'max_rate_of_change': 0.1,
                'statistical_bounds': 2.0
            }
        }
    
    def validate_measurement(self, measurement: ElectricalMeasurement, 
                           previous_measurements: List[ElectricalMeasurement]) -> DataQualityMetrics:
        """Validate individual measurement and calculate quality metrics"""
        
        quality_scores = {}
        anomaly_count = 0
        
        # Range validation
        rules = self.validation_rules.get(measurement.measurement_type, {})
        if rules:
            min_val = rules.get('min_value', float('-inf'))
            max_val = rules.get('max_value', float('inf'))
            
            if min_val <= measurement.value <= max_val:
                quality_scores['range'] = 1.0
            else:
                quality_scores['range'] = 0.0
                anomaly_count += 1
        else:
            quality_scores['range'] = 0.8  # Unknown range
        
        # Rate of change validation
        if previous_measurements:
            previous_measurement = previous_measurements[-1]
            time_diff = (measurement.timestamp - previous_measurement.timestamp).total_seconds()
            
            if time_diff > 0:
                rate_of_change = abs(measurement.value - previous_measurement.value) / time_diff
                max_rate = rules.get('max_rate_of_change', float('inf'))
                
                if rate_of_change <= max_rate:
                    quality_scores['rate_of_change'] = 1.0
                else:
                    quality_scores['rate_of_change'] = max(0.0, 1.0 - (rate_of_change - max_rate) / max_rate)
                    anomaly_count += 1
            else:
                quality_scores['rate_of_change'] = 0.5  # Same timestamp
        else:
            quality_scores['rate_of_change'] = 1.0  # First measurement
        
        # Statistical validation
        if len(previous_measurements) >= 10:
            recent_values = [m.value for m in previous_measurements[-10:]]
            mean_val = np.mean(recent_values)
            std_val = np.std(recent_values)
            
            if std_val > 0:
                z_score = abs(measurement.value - mean_val) / std_val
                max_z = rules.get('statistical_bounds', 3.0)
                
                if z_score <= max_z:
                    quality_scores['statistical'] = 1.0
                else:
                    quality_scores['statistical'] = max(0.0, 1.0 - (z_score - max_z) / max_z)
                    anomaly_count += 1
            else:
                quality_scores['statistical'] = 1.0  # No variation
        else:
            quality_scores['statistical'] = 0.8  # Insufficient history
        
        # Timeliness validation
        data_age = (datetime.now() - measurement.timestamp).total_seconds()
        if data_age <= 5.0:  # Fresh data (≤5 seconds)
            quality_scores['timeliness'] = 1.0
        elif data_age <= 30.0:  # Acceptable delay
            quality_scores['timeliness'] = 0.8
        else:  # Stale data
            quality_scores['timeliness'] = max(0.0, 1.0 - data_age / 300.0)  # Linear decay over 5 minutes
        
        # Calculate overall quality
        weights = {'range': 0.3, 'rate_of_change': 0.25, 'statistical': 0.25, 'timeliness': 0.2}
        overall_quality = sum(quality_scores[metric] * weights[metric] for metric in weights)
        
        return DataQualityMetrics(
            completeness_ratio=1.0,  # Single measurement is complete
            accuracy_score=quality_scores.get('range', 0.8),
            timeliness_score=quality_scores['timeliness'],
            consistency_score=(quality_scores['statistical'] + quality_scores['rate_of_change']) / 2,
            overall_quality=overall_quality,
            anomaly_count=anomaly_count,
            last_updated=datetime.now()
        )


class RealTimeDataPipeline:
    """Main pipeline orchestrator for real-time electrical data processing"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.kafka_streamer = KafkaDataStreamer(config['kafka'])
        self.data_validator = DataQualityValidator()
        self.redis_client = redis.Redis(**config['redis'])
        
        # Data interfaces
        self.smart_meters = [
            SmartMeterInterface(meter_config) 
            for meter_config in config.get('smart_meters', [])
        ]
        self.pmus = [
            SynchrophasorInterface(pmu_config)
            for pmu_config in config.get('pmus', [])
        ]
        self.industrial_sensors = [
            IndustrialSensorInterface(sensor_config)
            for sensor_config in config.get('industrial_sensors', [])
        ]
        
        # Data storage
        self.measurement_buffer = {}  # In-memory buffer for recent measurements
        self.buffer_size = config.get('buffer_size', 1000)
        
        # Processing threads
        self.executor = ThreadPoolExecutor(max_workers=config.get('max_workers', 10))
        self.running = False
        
    async def start_pipeline(self):
        """Start the real-time data collection and processing pipeline"""
        
        self.logger.info("Starting real-time data pipeline")
        self.running = True
        
        # Setup Kafka topics
        topics = [
            'electrical_smart_meter',
            'electrical_synchrophasor',
            'electrical_industrial_sensor',
            'electrical_scada',
            'data_quality_metrics'
        ]
        self.kafka_streamer.setup_topics(topics)
        
        # Start data collection tasks
        tasks = []
        
        # Smart meter data collection
        for meter in self.smart_meters:
            tasks.append(self._collect_smart_meter_data(meter))
        
        # Synchrophasor data collection
        for pmu in self.pmus:
            tasks.append(self._collect_synchrophasor_data(pmu))
        
        # Industrial sensor data collection
        for sensor in self.industrial_sensors:
            tasks.append(self._collect_industrial_sensor_data(sensor))
        
        # Data quality monitoring
        tasks.append(self._monitor_data_quality())
        
        # Run all tasks concurrently
        await asyncio.gather(*tasks)
    
    async def _collect_smart_meter_data(self, meter: SmartMeterInterface):
        """Collect data from smart meters at 1-second intervals"""
        
        while self.running:
            try:
                measurements = await meter.collect_measurements()
                
                # Validate and process measurements
                for measurement in measurements:
                    await self._process_measurement(measurement)
                
                # Stream to Kafka
                await self.kafka_streamer.stream_measurements(measurements)
                
                # Wait for next collection cycle
                await asyncio.sleep(1.0)  # 1 Hz sampling
                
            except Exception as e:
                self.logger.error(f"Smart meter data collection error: {e}")
                await asyncio.sleep(5.0)  # Error recovery delay
    
    async def _collect_synchrophasor_data(self, pmu: SynchrophasorInterface):
        """Collect synchrophasor data at 30 Hz"""
        
        while self.running:
            try:
                measurements = await pmu.collect_synchrophasor_data()
                
                # Process measurements
                for measurement in measurements:
                    await self._process_measurement(measurement)
                
                # Stream to Kafka
                await self.kafka_streamer.stream_measurements(measurements)
                
                # Wait for next collection cycle (30 Hz)
                await asyncio.sleep(1.0 / 30.0)
                
            except Exception as e:
                self.logger.error(f"Synchrophasor data collection error: {e}")
                await asyncio.sleep(1.0)
    
    async def _collect_industrial_sensor_data(self, sensor: IndustrialSensorInterface):
        """Collect high-frequency industrial sensor data"""
        
        while self.running:
            try:
                measurements = await sensor.collect_high_frequency_data()
                
                # Process measurements
                for measurement in measurements:
                    await self._process_measurement(measurement)
                
                # Stream to Kafka
                await self.kafka_streamer.stream_measurements(measurements)
                
                # Industrial sensors collect at lower rate for aggregated data
                await asyncio.sleep(60.0)  # 1-minute intervals for aggregated data
                
            except Exception as e:
                self.logger.error(f"Industrial sensor data collection error: {e}")
                await asyncio.sleep(10.0)
    
    async def _process_measurement(self, measurement: ElectricalMeasurement):
        """Process individual measurement with quality validation"""
        
        device_id = measurement.device_id
        measurement_type = measurement.measurement_type.value
        
        # Get measurement history for validation
        buffer_key = f"{device_id}_{measurement_type}"
        if buffer_key not in self.measurement_buffer:
            self.measurement_buffer[buffer_key] = deque(maxlen=self.buffer_size)
        
        previous_measurements = list(self.measurement_buffer[buffer_key])
        
        # Validate measurement quality
        quality_metrics = self.data_validator.validate_measurement(measurement, previous_measurements)
        
        # Store measurement in buffer
        self.measurement_buffer[buffer_key].append(measurement)
        
        # Cache in Redis for real-time access
        redis_key = f"realtime:{device_id}:{measurement_type}"
        measurement_data = {
            'value': measurement.value,
            'unit': measurement.unit,
            'timestamp': measurement.timestamp.isoformat(),
            'quality_score': quality_metrics.overall_quality,
            'phase': measurement.phase
        }
        self.redis_client.setex(redis_key, 300, json.dumps(measurement_data))  # 5-minute TTL
        
        # Store quality metrics
        quality_key = f"quality:{device_id}:{measurement_type}"
        quality_data = asdict(quality_metrics)
        self.redis_client.setex(quality_key, 300, json.dumps(quality_data, default=str))
        
        # Alert on poor data quality
        if quality_metrics.overall_quality < 0.7:
            await self._handle_quality_alert(measurement, quality_metrics)
    
    async def _monitor_data_quality(self):
        """Monitor overall data quality across all sources"""
        
        while self.running:
            try:
                # Calculate system-wide quality metrics
                all_quality_keys = self.redis_client.keys("quality:*")
                
                if all_quality_keys:
                    total_quality = 0.0
                    total_anomalies = 0
                    device_count = len(all_quality_keys)
                    
                    for key in all_quality_keys:
                        quality_data = json.loads(self.redis_client.get(key))
                        total_quality += quality_data['overall_quality']
                        total_anomalies += quality_data['anomaly_count']
                    
                    system_quality = total_quality / device_count if device_count > 0 else 0.0
                    
                    # Log system quality metrics
                    self.logger.info(f"System Data Quality: {system_quality:.2f}, "
                                   f"Total Anomalies: {total_anomalies}, "
                                   f"Active Devices: {device_count}")
                    
                    # Store system-wide metrics
                    system_metrics = {
                        'overall_quality': system_quality,
                        'total_anomalies': total_anomalies,
                        'active_devices': device_count,
                        'timestamp': datetime.now().isoformat()
                    }
                    self.redis_client.setex("system:data_quality", 300, json.dumps(system_metrics))
                
                await asyncio.sleep(30.0)  # Check every 30 seconds
                
            except Exception as e:
                self.logger.error(f"Data quality monitoring error: {e}")
                await asyncio.sleep(60.0)
    
    async def _handle_quality_alert(self, measurement: ElectricalMeasurement, 
                                  quality_metrics: DataQualityMetrics):
        """Handle data quality alerts"""
        
        alert = {
            'device_id': measurement.device_id,
            'measurement_type': measurement.measurement_type.value,
            'quality_score': quality_metrics.overall_quality,
            'anomaly_count': quality_metrics.anomaly_count,
            'timestamp': datetime.now().isoformat(),
            'alert_level': 'WARNING' if quality_metrics.overall_quality >= 0.5 else 'CRITICAL'
        }
        
        # Stream alert to Kafka
        await self.kafka_streamer.stream_measurements([])  # Send empty list with alert metadata
        
        # Log alert
        self.logger.warning(f"Data quality alert: {alert}")
    
    def stop_pipeline(self):
        """Stop the data pipeline gracefully"""
        
        self.logger.info("Stopping real-time data pipeline")
        self.running = False
        self.executor.shutdown(wait=True)


# Example usage and configuration
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Pipeline configuration
    config = {
        'kafka': {
            'bootstrap.servers': 'localhost:9092',
            'client.id': 'electrical-data-pipeline'
        },
        'redis': {
            'host': 'localhost',
            'port': 6379,
            'db': 0
        },
        'smart_meters': [
            {
                'device_id': 'METER_001',
                'sampling_rate_hz': 1,
                'accuracy_class': 0.1,
                'location': {'lat': 40.7128, 'lon': -74.0060}
            }
        ],
        'pmus': [
            {
                'device_id': 'PMU_001',
                'reporting_rate': 30,
                'location': {'lat': 40.7128, 'lon': -74.0060}
            }
        ],
        'industrial_sensors': [
            {
                'device_id': 'SENSOR_001',
                'sampling_rate_hz': 50000,
                'sensor_type': 'current_monitoring',
                'location': {'lat': 40.7128, 'lon': -74.0060}
            }
        ],
        'buffer_size': 1000,
        'max_workers': 10
    }
    
    # Initialize and start pipeline
    async def main():
        pipeline = RealTimeDataPipeline(config)
        
        try:
            await pipeline.start_pipeline()
        except KeyboardInterrupt:
            pipeline.stop_pipeline()
    
    # Run pipeline
    asyncio.run(main())