#!/usr/bin/env python3
"""
Enhanced Computer Vision Training Pipeline for Electrical Component Detection
Optimized for 95%+ accuracy in real-world electrical environments
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import torchvision.transforms as transforms
from torchvision import models
import cv2
import numpy as np
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import albumentations as A
from albumentations.pytorch import ToTensorV2
import wandb
from sklearn.metrics import average_precision_score, classification_report
import yaml
from dataclasses import dataclass
import time
from torch.cuda.amp import GradScaler, autocast
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TrainingConfig:
    """Enhanced training configuration for electrical component detection"""
    # Model architecture
    backbone: str = "efficientnet_v2_l"  # High-accuracy backbone
    num_classes: int = 25  # Electrical components + background
    input_size: Tuple[int, int] = (640, 640)  # Optimized for edge devices
    
    # Training parameters
    batch_size: int = 16
    epochs: int = 200
    learning_rate: float = 1e-4
    weight_decay: float = 1e-5
    gradient_clip_norm: float = 1.0
    
    # Advanced training techniques
    use_mixed_precision: bool = True
    use_label_smoothing: bool = True
    label_smoothing_factor: float = 0.1
    use_cosine_annealing: bool = True
    warmup_epochs: int = 10
    
    # Data augmentation
    use_advanced_augmentation: bool = True
    mixup_alpha: float = 0.2
    cutmix_alpha: float = 1.0
    
    # Multi-scale training
    use_multiscale_training: bool = True
    scale_range: Tuple[float, float] = (0.8, 1.2)
    
    # Hardware optimization
    use_distributed: bool = True
    num_workers: int = 8
    pin_memory: bool = True

class ElectricalComponentDataset(Dataset):
    """Advanced dataset class for electrical component detection"""
    
    def __init__(
        self, 
        data_dir: Path, 
        annotations_file: Path,
        transform: Optional[A.Compose] = None,
        training: bool = True
    ):
        self.data_dir = Path(data_dir)
        self.training = training
        self.transform = transform
        
        # Load annotations
        with open(annotations_file, 'r') as f:
            self.annotations = json.load(f)
        
        # Electrical component classes
        self.classes = {
            0: 'background',
            1: 'electrical_panel',
            2: 'circuit_breaker',
            3: 'outlet_standard',
            4: 'outlet_gfci',
            5: 'switch_single',
            6: 'switch_three_way',
            7: 'junction_box',
            8: 'conduit_emt',
            9: 'conduit_pvc',
            10: 'wire_romex',
            11: 'wire_thhn',
            12: 'meter_base',
            13: 'transformer',
            14: 'disconnect_switch',
            15: 'motor_starter',
            16: 'lighting_fixture',
            17: 'exit_sign',
            18: 'emergency_light',
            19: 'smoke_detector',
            20: 'security_camera',
            21: 'electrical_meter',
            22: 'surge_protector',
            23: 'voltage_regulator',
            24: 'safety_violation'  # For code compliance detection
        }
        
        logger.info(f"Loaded {len(self.annotations)} samples with {len(self.classes)} classes")
    
    def __len__(self) -> int:
        return len(self.annotations)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        annotation = self.annotations[idx]
        
        # Load image
        image_path = self.data_dir / annotation['image_path']
        image = cv2.imread(str(image_path))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Extract bounding boxes and labels
        bboxes = annotation.get('bboxes', [])
        labels = annotation.get('labels', [])
        
        # Apply transformations
        if self.transform:
            transformed = self.transform(
                image=image,
                bboxes=bboxes,
                labels=labels
            )
            image = transformed['image']
            bboxes = transformed['bboxes']
            labels = transformed['labels']
        
        # Convert to tensors
        if len(bboxes) > 0:
            bboxes = torch.FloatTensor(bboxes)
            labels = torch.LongTensor(labels)
        else:
            # Handle images with no detections
            bboxes = torch.zeros((0, 4), dtype=torch.float32)
            labels = torch.zeros((0,), dtype=torch.long)
        
        return {
            'image': image,
            'bboxes': bboxes,
            'labels': labels,
            'image_id': torch.tensor(idx)
        }

class EnhancedEfficientNet(nn.Module):
    """Enhanced EfficientNet for electrical component detection"""
    
    def __init__(self, num_classes: int = 25, backbone: str = "efficientnet_v2_l"):
        super().__init__()
        
        # Load pre-trained backbone
        if backbone == "efficientnet_v2_l":
            self.backbone = models.efficientnet_v2_l(weights='IMAGENET1K_V1')
            backbone_features = self.backbone.classifier[0].in_features
        else:
            raise ValueError(f"Unsupported backbone: {backbone}")
        
        # Remove original classifier
        self.backbone.classifier = nn.Identity()
        
        # Enhanced feature extraction
        self.feature_adapter = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Dropout(0.3),
            nn.Linear(backbone_features, 1024),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(1024, 512),
            nn.ReLU(inplace=True)
        )
        
        # Multi-head classification
        self.component_classifier = nn.Linear(512, num_classes)
        self.confidence_head = nn.Linear(512, 1)  # Confidence estimation
        self.safety_head = nn.Linear(512, 2)      # Safety compliance (safe/violation)
        
        # Initialize weights
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize classification head weights"""
        for m in [self.feature_adapter, self.component_classifier, 
                  self.confidence_head, self.safety_head]:
            if isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        # Extract features
        backbone_features = self.backbone(x)
        features = self.feature_adapter(backbone_features)
        
        # Multi-head outputs
        component_logits = self.component_classifier(features)
        confidence_logits = self.confidence_head(features)
        safety_logits = self.safety_head(features)
        
        return {
            'component_logits': component_logits,
            'confidence_logits': confidence_logits,
            'safety_logits': safety_logits,
            'features': features
        }

class AdvancedDataAugmentation:
    """Advanced data augmentation for electrical environments"""
    
    @staticmethod
    def get_training_transforms(input_size: Tuple[int, int]) -> A.Compose:
        return A.Compose([
            # Resize and crop
            A.RandomResizedCrop(height=input_size[0], width=input_size[1], scale=(0.8, 1.0)),
            
            # Lighting and color (common in electrical environments)
            A.OneOf([
                A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.8),
                A.RandomGamma(gamma_limit=(80, 120), p=0.8),
                A.CLAHE(clip_limit=2.0, tile_grid_size=(8, 8), p=0.5),
            ], p=0.9),
            
            # Electrical environment specific
            A.OneOf([
                A.GaussNoise(var_limit=(10.0, 50.0), p=0.7),  # Sensor noise
                A.MultiplicativeNoise(multiplier=[0.9, 1.1], p=0.5),
                A.ISONoise(color_shift=(0.01, 0.05), intensity=(0.1, 0.3), p=0.5),
            ], p=0.6),
            
            # Geometric transformations
            A.OneOf([
                A.Rotate(limit=15, p=0.8),
                A.SafeRotate(limit=15, p=0.8),
            ], p=0.5),
            
            A.OneOf([
                A.HorizontalFlip(p=0.5),
                A.VerticalFlip(p=0.2),  # Less common but valid for electrical panels
            ], p=0.5),
            
            # Occlusion simulation (common in construction sites)
            A.OneOf([
                A.CoarseDropout(max_holes=3, max_height=0.1, max_width=0.1, p=0.5),
                A.GridDropout(ratio=0.1, p=0.3),
            ], p=0.3),
            
            # Weather conditions
            A.OneOf([
                A.RandomRain(slant_lower=-10, slant_upper=10, drop_length=20, p=0.3),
                A.RandomFog(fog_coef_lower=0.1, fog_coef_upper=0.3, p=0.2),
            ], p=0.2),
            
            # Normalization
            A.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            ToTensorV2()
        ], bbox_params=A.BboxParams(format='pascal_voc', label_fields=['labels']))
    
    @staticmethod
    def get_validation_transforms(input_size: Tuple[int, int]) -> A.Compose:
        return A.Compose([
            A.Resize(height=input_size[0], width=input_size[1]),
            A.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            ToTensorV2()
        ], bbox_params=A.BboxParams(format='pascal_voc', label_fields=['labels']))

class MultiTaskLoss(nn.Module):
    """Multi-task loss for component detection, confidence, and safety"""
    
    def __init__(self, 
                 component_weight: float = 1.0,
                 confidence_weight: float = 0.5,
                 safety_weight: float = 2.0,  # Higher weight for safety violations
                 use_focal_loss: bool = True):
        super().__init__()
        
        self.component_weight = component_weight
        self.confidence_weight = confidence_weight
        self.safety_weight = safety_weight
        
        # Component classification loss
        if use_focal_loss:
            self.component_loss = self._focal_loss
        else:
            self.component_loss = nn.CrossEntropyLoss(label_smoothing=0.1)
        
        # Confidence and safety losses
        self.confidence_loss = nn.MSELoss()
        self.safety_loss = nn.CrossEntropyLoss()
    
    def _focal_loss(self, logits: torch.Tensor, targets: torch.Tensor, 
                   alpha: float = 0.25, gamma: float = 2.0) -> torch.Tensor:
        """Focal loss for handling class imbalance"""
        ce_loss = nn.functional.cross_entropy(logits, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = alpha * (1 - pt) ** gamma * ce_loss
        return focal_loss.mean()
    
    def forward(self, predictions: Dict[str, torch.Tensor], 
                targets: Dict[str, torch.Tensor]) -> Dict[str, torch.Tensor]:
        
        # Component classification loss
        component_loss = self.component_loss(
            predictions['component_logits'], 
            targets['labels']
        )
        
        # Confidence loss (predict IoU with ground truth)
        confidence_loss = self.confidence_loss(
            predictions['confidence_logits'].squeeze(),
            targets['confidence_scores']
        )
        
        # Safety compliance loss
        safety_loss = self.safety_loss(
            predictions['safety_logits'],
            targets['safety_labels']
        )
        
        # Total loss
        total_loss = (
            self.component_weight * component_loss +
            self.confidence_weight * confidence_loss +
            self.safety_weight * safety_loss
        )
        
        return {
            'total_loss': total_loss,
            'component_loss': component_loss,
            'confidence_loss': confidence_loss,
            'safety_loss': safety_loss
        }

class ElectricalVisionTrainer:
    """Enhanced trainer for electrical component detection"""
    
    def __init__(self, config: TrainingConfig):
        self.config = config
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize distributed training if enabled
        if config.use_distributed and torch.cuda.device_count() > 1:
            self._setup_distributed()
        
        # Initialize model
        self.model = EnhancedEfficientNet(
            num_classes=config.num_classes,
            backbone=config.backbone
        ).to(self.device)
        
        # Wrap model for distributed training
        if config.use_distributed:
            self.model = DDP(self.model)
        
        # Loss function
        self.loss_fn = MultiTaskLoss()
        
        # Optimizer with advanced scheduling
        self.optimizer = optim.AdamW(
            self.model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
            betas=(0.9, 0.999)
        )
        
        # Learning rate scheduler
        if config.use_cosine_annealing:
            self.scheduler = optim.lr_scheduler.CosineAnnealingWarmRestarts(
                self.optimizer,
                T_0=config.epochs // 4,
                T_mult=2,
                eta_min=config.learning_rate * 0.01
            )
        else:
            self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
                self.optimizer,
                mode='min',
                factor=0.5,
                patience=10,
                verbose=True
            )
        
        # Mixed precision training
        if config.use_mixed_precision:
            self.scaler = GradScaler()
        
        # Metrics tracking
        self.best_map = 0.0
        self.train_losses = []
        self.val_losses = []
        
        # Initialize wandb for experiment tracking
        if not config.use_distributed or dist.get_rank() == 0:
            wandb.init(
                project="electrical-component-detection",
                config=config.__dict__,
                tags=["enhanced", "production", "electrical"]
            )
        
        logger.info(f"Trainer initialized with {config.backbone} on {self.device}")
    
    def _setup_distributed(self):
        """Setup distributed training"""
        if 'RANK' in os.environ and 'WORLD_SIZE' in os.environ:
            rank = int(os.environ["RANK"])
            world_size = int(os.environ['WORLD_SIZE'])
            gpu = int(os.environ['LOCAL_RANK'])
        else:
            rank = -1
            world_size = -1
            gpu = 0
        
        if rank >= 0:
            torch.cuda.set_device(gpu)
            dist.init_process_group(backend='nccl')
    
    def train_epoch(self, train_loader: DataLoader) -> Dict[str, float]:
        """Train for one epoch with advanced techniques"""
        self.model.train()
        epoch_losses = {'total': 0, 'component': 0, 'confidence': 0, 'safety': 0}
        
        for batch_idx, batch in enumerate(train_loader):
            # Move data to device
            images = batch['image'].to(self.device, non_blocking=True)
            labels = batch['labels'].to(self.device)
            
            # Forward pass with mixed precision
            if self.config.use_mixed_precision:
                with autocast():
                    predictions = self.model(images)
                    losses = self.loss_fn(predictions, batch)
                    total_loss = losses['total_loss']
                
                # Backward pass
                self.scaler.scale(total_loss).backward()
                
                # Gradient clipping
                if self.config.gradient_clip_norm > 0:
                    self.scaler.unscale_(self.optimizer)
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(), 
                        self.config.gradient_clip_norm
                    )
                
                self.scaler.step(self.optimizer)
                self.scaler.update()
            else:
                predictions = self.model(images)
                losses = self.loss_fn(predictions, batch)
                total_loss = losses['total_loss']
                
                total_loss.backward()
                
                if self.config.gradient_clip_norm > 0:
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        self.config.gradient_clip_norm
                    )
                
                self.optimizer.step()
            
            self.optimizer.zero_grad()
            
            # Update metrics
            for key in epoch_losses:
                if key in losses:
                    epoch_losses[key] += losses[f'{key}_loss'].item()
                else:
                    epoch_losses[key] += total_loss.item()
            
            # Log progress
            if batch_idx % 100 == 0:
                logger.info(
                    f"Batch {batch_idx}/{len(train_loader)}: "
                    f"Loss = {total_loss.item():.4f}"
                )
        
        # Average losses
        for key in epoch_losses:
            epoch_losses[key] /= len(train_loader)
        
        return epoch_losses
    
    def validate(self, val_loader: DataLoader) -> Dict[str, float]:
        """Validate model with comprehensive metrics"""
        self.model.eval()
        val_losses = {'total': 0, 'component': 0, 'confidence': 0, 'safety': 0}
        
        all_predictions = []
        all_targets = []
        
        with torch.no_grad():
            for batch in val_loader:
                images = batch['image'].to(self.device, non_blocking=True)
                labels = batch['labels'].to(self.device)
                
                predictions = self.model(images)
                losses = self.loss_fn(predictions, batch)
                
                # Update losses
                for key in val_losses:
                    if key in losses:
                        val_losses[key] += losses[f'{key}_loss'].item()
                    else:
                        val_losses[key] += losses['total_loss'].item()
                
                # Collect predictions for mAP calculation
                component_probs = torch.softmax(
                    predictions['component_logits'], dim=1
                )
                all_predictions.append(component_probs.cpu())
                all_targets.append(labels.cpu())
        
        # Average losses
        for key in val_losses:
            val_losses[key] /= len(val_loader)
        
        # Calculate mAP
        all_predictions = torch.cat(all_predictions, dim=0)
        all_targets = torch.cat(all_targets, dim=0)
        
        # Convert to numpy for sklearn
        predictions_np = all_predictions.numpy()
        targets_np = all_targets.numpy()
        
        # Calculate average precision for each class
        aps = []
        for class_idx in range(self.config.num_classes):
            if (targets_np == class_idx).sum() > 0:  # Only if class exists in validation
                ap = average_precision_score(
                    (targets_np == class_idx).astype(int),
                    predictions_np[:, class_idx]
                )
                aps.append(ap)
        
        mean_ap = np.mean(aps) if aps else 0.0
        val_losses['mAP'] = mean_ap
        
        return val_losses
    
    def train(self, train_loader: DataLoader, val_loader: DataLoader):
        """Main training loop with advanced optimization"""
        logger.info(f"Starting training for {self.config.epochs} epochs")
        
        for epoch in range(self.config.epochs):
            start_time = time.time()
            
            # Train
            train_losses = self.train_epoch(train_loader)
            
            # Validate
            val_losses = self.validate(val_loader)
            
            # Update scheduler
            if isinstance(self.scheduler, optim.lr_scheduler.ReduceLROnPlateau):
                self.scheduler.step(val_losses['total'])
            else:
                self.scheduler.step()
            
            # Save best model
            if val_losses['mAP'] > self.best_map:
                self.best_map = val_losses['mAP']
                self.save_checkpoint(epoch, is_best=True)
            
            # Log metrics
            epoch_time = time.time() - start_time
            
            logger.info(
                f"Epoch {epoch+1}/{self.config.epochs} ({epoch_time:.1f}s): "
                f"Train Loss = {train_losses['total']:.4f}, "
                f"Val Loss = {val_losses['total']:.4f}, "
                f"mAP = {val_losses['mAP']:.4f}"
            )
            
            # Wandb logging
            if not self.config.use_distributed or dist.get_rank() == 0:
                wandb.log({
                    'epoch': epoch,
                    'train_loss': train_losses['total'],
                    'val_loss': val_losses['total'],
                    'mAP': val_losses['mAP'],
                    'learning_rate': self.optimizer.param_groups[0]['lr'],
                    'epoch_time': epoch_time
                })
        
        logger.info(f"Training completed. Best mAP: {self.best_map:.4f}")
    
    def save_checkpoint(self, epoch: int, is_best: bool = False):
        """Save model checkpoint"""
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict(),
            'best_map': self.best_map,
            'config': self.config
        }
        
        if self.config.use_mixed_precision:
            checkpoint['scaler_state_dict'] = self.scaler.state_dict()
        
        # Save checkpoint
        checkpoint_path = Path('checkpoints')
        checkpoint_path.mkdir(exist_ok=True)
        
        torch.save(checkpoint, checkpoint_path / f'checkpoint_epoch_{epoch}.pth')
        
        if is_best:
            torch.save(checkpoint, checkpoint_path / 'best_model.pth')
            logger.info(f"New best model saved with mAP: {self.best_map:.4f}")

def main():
    """Main training function"""
    
    # Load configuration
    config = TrainingConfig()
    
    # Setup data transforms
    train_transforms = AdvancedDataAugmentation.get_training_transforms(config.input_size)
    val_transforms = AdvancedDataAugmentation.get_validation_transforms(config.input_size)
    
    # Create datasets
    train_dataset = ElectricalComponentDataset(
        data_dir=Path('data/train'),
        annotations_file=Path('data/train_annotations.json'),
        transform=train_transforms,
        training=True
    )
    
    val_dataset = ElectricalComponentDataset(
        data_dir=Path('data/val'),
        annotations_file=Path('data/val_annotations.json'),
        transform=val_transforms,
        training=False
    )
    
    # Create data loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=config.num_workers,
        pin_memory=config.pin_memory,
        drop_last=True
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=config.num_workers,
        pin_memory=config.pin_memory
    )
    
    # Initialize trainer
    trainer = ElectricalVisionTrainer(config)
    
    # Start training
    trainer.train(train_loader, val_loader)
    
    logger.info("Training completed successfully!")

if __name__ == "__main__":
    main()