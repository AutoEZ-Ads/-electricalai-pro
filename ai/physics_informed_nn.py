#!/usr/bin/env python3
"""
Physics-Informed Neural Network for Electrical Calculations
Implements PINN architecture for voltage drop, load calculations, and NEC compliance
Based on the AI implementation roadmap for electrical contracting businesses
"""

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import pandas as pd
from typing import Dict, List, Tuple, Optional
import json
from dataclasses import dataclass
from enum import Enum


class ConductorType(Enum):
    COPPER = "copper"
    ALUMINUM = "aluminum"


class InsulationType(Enum):
    THWN = "THWN"
    THHN = "THHN"
    XHHW = "XHHW"
    USE = "USE"


@dataclass
class ConductorProperties:
    """Standard conductor properties based on NEC tables"""
    awg_size: str
    resistance_ohm_per_kft: float  # Ohms per 1000 feet at 75°C
    ampacity: int  # Current carrying capacity in amps
    area_circular_mils: int
    material: ConductorType
    insulation: InsulationType


@dataclass
class CircuitParameters:
    """Input parameters for electrical circuit calculations"""
    conductor: ConductorProperties
    length_feet: float
    current_amps: float
    voltage: int  # 120, 240, 277, 480
    power_factor: float = 0.9
    temperature_correction: float = 1.0
    conduit_fill_factor: float = 1.0


class ElectricalPhysicsLaws:
    """Physical constraints for electrical calculations"""
    
    @staticmethod
    def ohms_law_constraint(voltage: tf.Tensor, current: tf.Tensor, resistance: tf.Tensor) -> tf.Tensor:
        """V = I * R constraint"""
        return tf.square(voltage - current * resistance)
    
    @staticmethod
    def power_constraint(power: tf.Tensor, voltage: tf.Tensor, current: tf.Tensor, pf: tf.Tensor) -> tf.Tensor:
        """P = V * I * cos(φ) constraint"""
        return tf.square(power - voltage * current * pf)
    
    @staticmethod
    def voltage_drop_constraint(vd_percent: tf.Tensor, max_percent: float = 3.0) -> tf.Tensor:
        """NEC voltage drop constraint (3% for branch circuits, 5% for feeders)"""
        return tf.maximum(0.0, vd_percent - max_percent)
    
    @staticmethod
    def ampacity_constraint(current: tf.Tensor, ampacity: tf.Tensor) -> tf.Tensor:
        """Current must not exceed conductor ampacity"""
        return tf.maximum(0.0, current - ampacity)


class PhysicsInformedNN(keras.Model):
    """
    Physics-Informed Neural Network for electrical calculations
    Architecture: 4 hidden layers, 64-128 neurons per layer for ±2% accuracy
    """
    
    def __init__(self, input_dim: int = 8, hidden_units: List[int] = [128, 128, 64, 64]):
        super(PhysicsInformedNN, self).__init__()
        
        # Network architecture based on research recommendations
        self.dense_layers = []
        for units in hidden_units:
            self.dense_layers.append(layers.Dense(units, activation='relu'))
            self.dense_layers.append(layers.BatchNormalization())
            self.dense_layers.append(layers.Dropout(0.1))
        
        # Output layers for different electrical parameters
        self.voltage_drop_output = layers.Dense(1, activation='linear', name='voltage_drop')
        self.power_loss_output = layers.Dense(1, activation='linear', name='power_loss')
        self.temperature_rise_output = layers.Dense(1, activation='linear', name='temperature_rise')
        self.efficiency_output = layers.Dense(1, activation='sigmoid', name='efficiency')
    
    def call(self, inputs, training=None):
        x = inputs
        
        # Forward pass through hidden layers
        for layer in self.dense_layers:
            x = layer(x, training=training)
        
        # Multi-output predictions
        voltage_drop = self.voltage_drop_output(x)
        power_loss = self.power_loss_output(x)
        temperature_rise = self.temperature_rise_output(x)
        efficiency = self.efficiency_output(x)
        
        return {
            'voltage_drop': voltage_drop,
            'power_loss': power_loss,
            'temperature_rise': temperature_rise,
            'efficiency': efficiency
        }


class VoltageDropCalculator:
    """High-precision voltage drop calculator using PINN"""
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = PhysicsInformedNN()
        self.physics_laws = ElectricalPhysicsLaws()
        self.conductor_database = self._load_conductor_database()
        
        if model_path:
            self.model.load_weights(model_path)
    
    def _load_conductor_database(self) -> Dict[str, ConductorProperties]:
        """Load standard conductor properties from NEC tables"""
        conductors = {
            "12_COPPER_THWN": ConductorProperties(
                awg_size="12", resistance_ohm_per_kft=2.01, ampacity=20,
                area_circular_mils=6530, material=ConductorType.COPPER,
                insulation=InsulationType.THWN
            ),
            "10_COPPER_THWN": ConductorProperties(
                awg_size="10", resistance_ohm_per_kft=1.26, ampacity=30,
                area_circular_mils=10380, material=ConductorType.COPPER,
                insulation=InsulationType.THWN
            ),
            "8_COPPER_THWN": ConductorProperties(
                awg_size="8", resistance_ohm_per_kft=0.778, ampacity=50,
                area_circular_mils=16510, material=ConductorType.COPPER,
                insulation=InsulationType.THWN
            ),
            "6_COPPER_THWN": ConductorProperties(
                awg_size="6", resistance_ohm_per_kft=0.491, ampacity=65,
                area_circular_mils=26240, material=ConductorType.COPPER,
                insulation=InsulationType.THWN
            ),
            "4_COPPER_THWN": ConductorProperties(
                awg_size="4", resistance_ohm_per_kft=0.308, ampacity=85,
                area_circular_mils=41740, material=ConductorType.COPPER,
                insulation=InsulationType.THWN
            )
        }
        return conductors
    
    def calculate_voltage_drop(self, circuit: CircuitParameters) -> Dict[str, float]:
        """
        Calculate voltage drop using both classical formula and PINN prediction
        Returns both methods for validation and accuracy comparison
        """
        
        # Classical calculation (IEEE 141 standard)
        resistance_total = (circuit.conductor.resistance_ohm_per_kft * circuit.length_feet) / 1000
        
        if circuit.voltage in [120, 240]:  # Single phase
            voltage_drop_volts = 2 * circuit.current_amps * resistance_total
        else:  # Three phase (277, 480)
            voltage_drop_volts = 1.732 * circuit.current_amps * resistance_total
        
        voltage_drop_percent = (voltage_drop_volts / circuit.voltage) * 100
        power_loss_watts = circuit.current_amps**2 * resistance_total
        
        # PINN prediction
        input_features = self._prepare_input_features(circuit)
        pinn_predictions = self.model(input_features)
        
        # Physics constraints validation
        physics_loss = self._calculate_physics_loss(circuit, pinn_predictions)
        
        return {
            'classical_voltage_drop_volts': float(voltage_drop_volts),
            'classical_voltage_drop_percent': float(voltage_drop_percent),
            'classical_power_loss_watts': float(power_loss_watts),
            'pinn_voltage_drop_volts': float(pinn_predictions['voltage_drop'][0]),
            'pinn_power_loss_watts': float(pinn_predictions['power_loss'][0]),
            'pinn_temperature_rise_c': float(pinn_predictions['temperature_rise'][0]),
            'pinn_efficiency': float(pinn_predictions['efficiency'][0]),
            'physics_constraint_loss': float(physics_loss),
            'nec_compliant': voltage_drop_percent <= 3.0,
            'ampacity_compliant': circuit.current_amps <= circuit.conductor.ampacity,
            'confidence_score': self._calculate_confidence(physics_loss)
        }
    
    def _prepare_input_features(self, circuit: CircuitParameters) -> tf.Tensor:
        """Prepare normalized input features for PINN"""
        features = np.array([[
            circuit.conductor.resistance_ohm_per_kft / 10.0,  # Normalized resistance
            circuit.length_feet / 1000.0,  # Normalized length
            circuit.current_amps / 100.0,  # Normalized current
            circuit.voltage / 480.0,  # Normalized voltage
            circuit.power_factor,
            circuit.temperature_correction,
            circuit.conduit_fill_factor,
            circuit.conductor.ampacity / 400.0  # Normalized ampacity
        ]], dtype=np.float32)
        
        return tf.constant(features)
    
    def _calculate_physics_loss(self, circuit: CircuitParameters, predictions: Dict) -> tf.Tensor:
        """Calculate physics-based loss for constraint validation"""
        
        # Extract predictions
        vd_volts = predictions['voltage_drop']
        power_loss = predictions['power_loss']
        
        # Calculate expected values
        resistance = (circuit.conductor.resistance_ohm_per_kft * circuit.length_feet) / 1000
        expected_vd = 2 * circuit.current_amps * resistance if circuit.voltage <= 240 else 1.732 * circuit.current_amps * resistance
        expected_power_loss = circuit.current_amps**2 * resistance
        
        # Physics constraints
        ohms_loss = tf.square(vd_volts - expected_vd)
        power_loss_constraint = tf.square(power_loss - expected_power_loss)
        voltage_drop_percent = (vd_volts / circuit.voltage) * 100
        nec_constraint = self.physics_laws.voltage_drop_constraint(voltage_drop_percent)
        ampacity_constraint = self.physics_laws.ampacity_constraint(
            tf.constant([circuit.current_amps]), 
            tf.constant([circuit.conductor.ampacity])
        )
        
        total_loss = ohms_loss + power_loss_constraint + nec_constraint + ampacity_constraint
        return tf.reduce_mean(total_loss)
    
    def _calculate_confidence(self, physics_loss: tf.Tensor) -> float:
        """Calculate confidence score based on physics constraint satisfaction"""
        loss_value = float(physics_loss)
        # Convert loss to confidence score (0-100%)
        confidence = max(0, 100 - (loss_value * 100))
        return min(100, confidence)
    
    def train_model(self, training_data: pd.DataFrame, epochs: int = 1000):
        """Train the PINN model with physics-informed loss function"""
        
        # Prepare training data
        X_train = self._prepare_training_features(training_data)
        y_train = self._prepare_training_targets(training_data)
        
        # Custom physics-informed loss function
        def physics_informed_loss(y_true, y_pred):
            # Standard MSE loss
            mse_loss = tf.keras.losses.mse(y_true, y_pred)
            
            # Physics constraint loss
            physics_loss = self._batch_physics_loss(X_train, y_pred)
            
            # Combined loss with physics weighting
            total_loss = mse_loss + 0.1 * physics_loss
            return total_loss
        
        # Compile and train
        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss=physics_informed_loss,
            metrics=['mae', 'mse']
        )
        
        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=32,
            validation_split=0.2,
            verbose=1
        )
        
        return history
    
    def _prepare_training_features(self, data: pd.DataFrame) -> np.ndarray:
        """Prepare normalized training features"""
        features = []
        for _, row in data.iterrows():
            feature_vector = [
                row['resistance'] / 10.0,
                row['length'] / 1000.0,
                row['current'] / 100.0,
                row['voltage'] / 480.0,
                row['power_factor'],
                row['temperature_correction'],
                row['conduit_fill'],
                row['ampacity'] / 400.0
            ]
            features.append(feature_vector)
        return np.array(features, dtype=np.float32)
    
    def _prepare_training_targets(self, data: pd.DataFrame) -> Dict[str, np.ndarray]:
        """Prepare training targets for multi-output model"""
        return {
            'voltage_drop': data['voltage_drop_volts'].values.reshape(-1, 1),
            'power_loss': data['power_loss_watts'].values.reshape(-1, 1),
            'temperature_rise': data['temperature_rise_c'].values.reshape(-1, 1),
            'efficiency': data['efficiency'].values.reshape(-1, 1)
        }
    
    def _batch_physics_loss(self, X_batch: tf.Tensor, predictions: Dict) -> tf.Tensor:
        """Calculate physics loss for a batch of predictions"""
        batch_losses = []
        
        for i in range(tf.shape(X_batch)[0]):
            # Extract batch element
            resistance = X_batch[i, 0] * 10.0
            length = X_batch[i, 1] * 1000.0
            current = X_batch[i, 2] * 100.0
            voltage = X_batch[i, 3] * 480.0
            
            # Physics constraints for this sample
            vd_pred = predictions['voltage_drop'][i]
            expected_vd = 2 * current * resistance * length / 1000  # Simplified
            
            loss = tf.square(vd_pred - expected_vd)
            batch_losses.append(loss)
        
        return tf.reduce_mean(batch_losses)


# Example usage and testing
if __name__ == "__main__":
    # Initialize calculator
    calculator = VoltageDropCalculator()
    
    # Example circuit
    conductor = ConductorProperties(
        awg_size="12", resistance_ohm_per_kft=2.01, ampacity=20,
        area_circular_mils=6530, material=ConductorType.COPPER,
        insulation=InsulationType.THWN
    )
    
    circuit = CircuitParameters(
        conductor=conductor,
        length_feet=100,
        current_amps=15,
        voltage=120,
        power_factor=0.9
    )
    
    # Calculate voltage drop
    results = calculator.calculate_voltage_drop(circuit)
    
    print("Voltage Drop Analysis Results:")
    print(f"Classical Method: {results['classical_voltage_drop_percent']:.2f}% ({results['classical_voltage_drop_volts']:.2f}V)")
    print(f"PINN Prediction: {results['pinn_voltage_drop_volts']:.2f}V")
    print(f"Power Loss: {results['classical_power_loss_watts']:.2f}W")
    print(f"NEC Compliant: {results['nec_compliant']}")
    print(f"Ampacity Compliant: {results['ampacity_compliant']}")
    print(f"Confidence Score: {results['confidence_score']:.1f}%")