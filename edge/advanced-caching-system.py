#!/usr/bin/env python3
"""
Advanced Multi-Layer Caching System for Edge Electrical Estimation
Optimized for sub-5ms response times with intelligent cache management
"""

import asyncio
import redis.asyncio as redis
import json
import pickle
import hashlib
import time
import logging
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np
from datetime import datetime, timedelta
import lru
import asyncio_mqtt
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
import zlib
import msgpack
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CacheLevel(Enum):
    """Cache levels with different performance characteristics"""
    L1_MEMORY = "l1_memory"      # In-memory LRU cache (< 1ms)
    L2_REDIS = "l2_redis"        # Redis cache (1-3ms)
    L3_LOCAL_DB = "l3_local_db"  # Local SQLite (3-10ms)
    L4_NETWORK = "l4_network"    # Network/Cloud storage (>10ms)

class CacheStrategy(Enum):
    """Caching strategies for different data types"""
    LRU = "lru"                  # Least Recently Used
    LFU = "lfu"                  # Least Frequently Used
    TTL = "ttl"                  # Time To Live
    PREDICTIVE = "predictive"    # ML-based prediction
    PRIORITY = "priority"        # Priority-based eviction

@dataclass
class CacheItem:
    """Cache item with metadata"""
    key: str
    value: Any
    created_at: datetime
    last_accessed: datetime
    access_count: int
    ttl_seconds: Optional[int]
    priority: int
    size_bytes: int
    cache_level: CacheLevel
    compressed: bool = False
    
    def is_expired(self) -> bool:
        """Check if cache item has expired"""
        if self.ttl_seconds is None:
            return False
        return (datetime.now() - self.created_at).total_seconds() > self.ttl_seconds
    
    def touch(self):
        """Update access metadata"""
        self.last_accessed = datetime.now()
        self.access_count += 1

@dataclass
class CacheStats:
    """Cache performance statistics"""
    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    l1_hits: int = 0
    l2_hits: int = 0
    l3_hits: int = 0
    l4_hits: int = 0
    avg_response_time_ms: float = 0.0
    total_size_bytes: int = 0
    
    @property
    def hit_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.cache_hits / self.total_requests
    
    def record_hit(self, level: CacheLevel, response_time_ms: float):
        self.total_requests += 1
        self.cache_hits += 1
        
        if level == CacheLevel.L1_MEMORY:
            self.l1_hits += 1
        elif level == CacheLevel.L2_REDIS:
            self.l2_hits += 1
        elif level == CacheLevel.L3_LOCAL_DB:
            self.l3_hits += 1
        elif level == CacheLevel.L4_NETWORK:
            self.l4_hits += 1
        
        # Update average response time
        self.avg_response_time_ms = (
            (self.avg_response_time_ms * (self.total_requests - 1) + response_time_ms) 
            / self.total_requests
        )
    
    def record_miss(self, response_time_ms: float):
        self.total_requests += 1
        self.cache_misses += 1
        
        # Update average response time
        self.avg_response_time_ms = (
            (self.avg_response_time_ms * (self.total_requests - 1) + response_time_ms) 
            / self.total_requests
        )

class IntelligentCompressionManager:
    """Intelligent compression based on data characteristics"""
    
    @staticmethod
    def should_compress(data: Any, size_threshold: int = 1024) -> bool:
        """Determine if data should be compressed"""
        if isinstance(data, (str, bytes)):
            return len(data) > size_threshold
        
        # Estimate size for other types
        try:
            serialized = pickle.dumps(data)
            return len(serialized) > size_threshold
        except:
            return False
    
    @staticmethod
    def compress_data(data: Any) -> Tuple[bytes, bool]:
        """Compress data using optimal algorithm"""
        try:
            # Serialize data
            if isinstance(data, (dict, list)):
                serialized = msgpack.packb(data)
            else:
                serialized = pickle.dumps(data)
            
            # Compress if beneficial
            if len(serialized) > 512:
                compressed = zlib.compress(serialized, level=6)
                if len(compressed) < len(serialized) * 0.8:  # 20% compression ratio
                    return compressed, True
            
            return serialized, False
        except Exception as e:
            logger.warning(f"Compression failed: {e}")
            return pickle.dumps(data), False
    
    @staticmethod
    def decompress_data(data: bytes, was_compressed: bool) -> Any:
        """Decompress and deserialize data"""
        try:
            if was_compressed:
                decompressed = zlib.decompress(data)
            else:
                decompressed = data
            
            # Try msgpack first, fallback to pickle
            try:
                return msgpack.unpackb(decompressed, raw=False)
            except:
                return pickle.loads(decompressed)
        except Exception as e:
            logger.error(f"Decompression failed: {e}")
            raise

class PredictiveCacheManager:
    """ML-based predictive caching for electrical calculations"""
    
    def __init__(self):
        self.access_patterns = {}
        self.prediction_model = None
        self.pattern_history = []
        
    def record_access(self, key: str, timestamp: datetime):
        """Record cache access for pattern learning"""
        if key not in self.access_patterns:
            self.access_patterns[key] = []
        
        self.access_patterns[key].append(timestamp)
        
        # Keep only recent history (last 1000 accesses)
        if len(self.access_patterns[key]) > 1000:
            self.access_patterns[key] = self.access_patterns[key][-1000:]
    
    def predict_next_access(self, key: str) -> Optional[datetime]:
        """Predict when a key will be accessed next"""
        if key not in self.access_patterns or len(self.access_patterns[key]) < 3:
            return None
        
        # Simple prediction based on access intervals
        accesses = self.access_patterns[key]
        intervals = [
            (accesses[i] - accesses[i-1]).total_seconds() 
            for i in range(1, len(accesses))
        ]
        
        if not intervals:
            return None
        
        # Weighted average of recent intervals
        weights = np.exp(-np.arange(len(intervals))[::-1] / 10)  # Exponential decay
        avg_interval = np.average(intervals, weights=weights)
        
        return accesses[-1] + timedelta(seconds=avg_interval)
    
    def get_preload_candidates(self, max_candidates: int = 10) -> List[str]:
        """Get keys that should be preloaded based on predictions"""
        candidates = []
        now = datetime.now()
        
        for key, accesses in self.access_patterns.items():
            if len(accesses) < 3:
                continue
            
            next_access = self.predict_next_access(key)
            if next_access and next_access <= now + timedelta(minutes=5):
                # Calculate priority based on predicted access time and frequency
                time_score = max(0, 1 - (next_access - now).total_seconds() / 300)  # 5 min window
                frequency_score = min(1, len(accesses) / 100)  # Normalize frequency
                
                candidates.append({
                    'key': key,
                    'score': time_score * 0.7 + frequency_score * 0.3,
                    'predicted_access': next_access
                })
        
        # Sort by score and return top candidates
        candidates.sort(key=lambda x: x['score'], reverse=True)
        return [c['key'] for c in candidates[:max_candidates]]

class AdvancedEdgeCacheSystem:
    """Multi-layer caching system optimized for electrical estimation edge computing"""
    
    def __init__(
        self,
        l1_size: int = 10000,           # L1 cache size (items)
        l2_redis_url: str = "redis://localhost:6379",
        l3_db_path: str = "edge_cache.db",
        compression_threshold: int = 1024,
        enable_predictive: bool = True
    ):
        self.l1_size = l1_size
        self.compression_threshold = compression_threshold
        self.enable_predictive = enable_predictive
        
        # Initialize cache layers
        self.l1_cache = lru.LRU(l1_size)  # In-memory LRU cache
        self.l2_redis = None              # Redis connection (async)
        self.l3_db_path = l3_db_path      # SQLite database path
        self.l3_lock = threading.Lock()   # SQLite thread safety
        
        # Cache managers
        self.compression_manager = IntelligentCompressionManager()
        self.predictive_manager = PredictiveCacheManager() if enable_predictive else None
        
        # Performance tracking
        self.stats = CacheStats()
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Initialize components
        asyncio.create_task(self._initialize_async_components())
        self._initialize_l3_database()
        
        logger.info("Advanced edge cache system initialized")
    
    async def _initialize_async_components(self):
        """Initialize async components (Redis)"""
        try:
            self.l2_redis = redis.from_url("redis://localhost:6379", decode_responses=False)
            await self.l2_redis.ping()
            logger.info("Redis L2 cache connected")
        except Exception as e:
            logger.warning(f"Redis L2 cache unavailable: {e}")
            self.l2_redis = None
    
    def _initialize_l3_database(self):
        """Initialize SQLite L3 cache database"""
        try:
            with sqlite3.connect(self.l3_db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cache_items (
                        key TEXT PRIMARY KEY,
                        value BLOB,
                        created_at REAL,
                        last_accessed REAL,
                        access_count INTEGER,
                        ttl_seconds INTEGER,
                        priority INTEGER,
                        size_bytes INTEGER,
                        compressed INTEGER
                    )
                """)
                
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_last_accessed 
                    ON cache_items(last_accessed)
                """)
                
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_priority_access 
                    ON cache_items(priority DESC, last_accessed DESC)
                """)
                
                conn.commit()
                logger.info("SQLite L3 cache database initialized")
        except Exception as e:
            logger.error(f"Failed to initialize L3 database: {e}")
            raise
    
    def _generate_cache_key(self, key: str, params: Dict[str, Any] = None) -> str:
        """Generate deterministic cache key"""
        if params:
            # Sort parameters for consistent key generation
            param_str = json.dumps(params, sort_keys=True)
            key_data = f"{key}:{param_str}"
        else:
            key_data = key
        
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]
    
    async def get(
        self, 
        key: str, 
        params: Dict[str, Any] = None,
        default: Any = None
    ) -> Tuple[Any, CacheLevel]:
        """Get value from multi-layer cache"""
        start_time = time.perf_counter()
        cache_key = self._generate_cache_key(key, params)
        
        # Record access for predictive caching
        if self.predictive_manager:
            self.predictive_manager.record_access(cache_key, datetime.now())
        
        try:
            # L1: In-memory cache (fastest)
            if cache_key in self.l1_cache:
                value = self.l1_cache[cache_key]
                response_time = (time.perf_counter() - start_time) * 1000
                self.stats.record_hit(CacheLevel.L1_MEMORY, response_time)
                logger.debug(f"L1 cache hit for {key} in {response_time:.2f}ms")
                return value, CacheLevel.L1_MEMORY
            
            # L2: Redis cache
            if self.l2_redis:
                try:
                    cached_data = await self.l2_redis.get(cache_key)
                    if cached_data:
                        # Decompress and deserialize
                        metadata_size = int.from_bytes(cached_data[:4], 'big')
                        metadata = json.loads(cached_data[4:4+metadata_size].decode())
                        data_bytes = cached_data[4+metadata_size:]
                        
                        value = self.compression_manager.decompress_data(
                            data_bytes, metadata['compressed']
                        )
                        
                        # Promote to L1 cache
                        self.l1_cache[cache_key] = value
                        
                        response_time = (time.perf_counter() - start_time) * 1000
                        self.stats.record_hit(CacheLevel.L2_REDIS, response_time)
                        logger.debug(f"L2 cache hit for {key} in {response_time:.2f}ms")
                        return value, CacheLevel.L2_REDIS
                except Exception as e:
                    logger.warning(f"L2 cache error: {e}")
            
            # L3: Local SQLite database
            l3_result = await self._get_from_l3(cache_key)
            if l3_result:
                value, metadata = l3_result
                
                # Promote to higher cache levels
                self.l1_cache[cache_key] = value
                if self.l2_redis:
                    await self._store_in_l2(cache_key, value, metadata)
                
                response_time = (time.perf_counter() - start_time) * 1000
                self.stats.record_hit(CacheLevel.L3_LOCAL_DB, response_time)
                logger.debug(f"L3 cache hit for {key} in {response_time:.2f}ms")
                return value, CacheLevel.L3_LOCAL_DB
            
            # Cache miss
            response_time = (time.perf_counter() - start_time) * 1000
            self.stats.record_miss(response_time)
            logger.debug(f"Cache miss for {key} in {response_time:.2f}ms")
            return default, None
            
        except Exception as e:
            logger.error(f"Cache get error for {key}: {e}")
            response_time = (time.perf_counter() - start_time) * 1000
            self.stats.record_miss(response_time)
            return default, None
    
    async def set(
        self,
        key: str,
        value: Any,
        params: Dict[str, Any] = None,
        ttl_seconds: Optional[int] = None,
        priority: int = 1
    ):
        """Set value in multi-layer cache"""
        cache_key = self._generate_cache_key(key, params)
        
        # Calculate value size
        try:
            size_bytes = len(pickle.dumps(value))
        except:
            size_bytes = 1024  # Estimate
        
        # Create cache item metadata
        now = datetime.now()
        metadata = {
            'created_at': now.timestamp(),
            'last_accessed': now.timestamp(),
            'access_count': 1,
            'ttl_seconds': ttl_seconds,
            'priority': priority,
            'size_bytes': size_bytes
        }
        
        # Store in L1 cache
        self.l1_cache[cache_key] = value
        
        # Store in L2 Redis cache
        if self.l2_redis:
            try:
                await self._store_in_l2(cache_key, value, metadata)
            except Exception as e:
                logger.warning(f"L2 cache store error: {e}")
        
        # Store in L3 SQLite cache
        try:
            await self._store_in_l3(cache_key, value, metadata)
        except Exception as e:
            logger.warning(f"L3 cache store error: {e}")
        
        logger.debug(f"Cached {key} across all available levels")
    
    async def _get_from_l3(self, cache_key: str) -> Optional[Tuple[Any, Dict[str, Any]]]:
        """Get value from L3 SQLite cache"""
        def _get_sync():
            with self.l3_lock:
                with sqlite3.connect(self.l3_db_path) as conn:
                    cursor = conn.execute("""
                        SELECT value, created_at, last_accessed, access_count, 
                               ttl_seconds, priority, size_bytes, compressed
                        FROM cache_items 
                        WHERE key = ?
                    """, (cache_key,))
                    
                    row = cursor.fetchone()
                    if not row:
                        return None
                    
                    value_blob, created_at, last_accessed, access_count, \
                    ttl_seconds, priority, size_bytes, compressed = row
                    
                    # Check TTL
                    if ttl_seconds and (time.time() - created_at) > ttl_seconds:
                        conn.execute("DELETE FROM cache_items WHERE key = ?", (cache_key,))
                        conn.commit()
                        return None
                    
                    # Update access metadata
                    conn.execute("""
                        UPDATE cache_items 
                        SET last_accessed = ?, access_count = access_count + 1
                        WHERE key = ?
                    """, (time.time(), cache_key))
                    conn.commit()
                    
                    # Deserialize value
                    value = self.compression_manager.decompress_data(
                        value_blob, bool(compressed)
                    )
                    
                    metadata = {
                        'created_at': created_at,
                        'last_accessed': time.time(),
                        'access_count': access_count + 1,
                        'ttl_seconds': ttl_seconds,
                        'priority': priority,
                        'size_bytes': size_bytes,
                        'compressed': bool(compressed)
                    }
                    
                    return value, metadata
        
        return await asyncio.get_event_loop().run_in_executor(
            self.executor, _get_sync
        )
    
    async def _store_in_l2(self, cache_key: str, value: Any, metadata: Dict[str, Any]):
        """Store value in L2 Redis cache"""
        try:
            # Compress and serialize
            data_bytes, compressed = self.compression_manager.compress_data(value)
            metadata['compressed'] = compressed
            
            # Pack metadata and data
            metadata_json = json.dumps(metadata).encode()
            metadata_size = len(metadata_json).to_bytes(4, 'big')
            
            packed_data = metadata_size + metadata_json + data_bytes
            
            # Set with TTL
            ttl = metadata.get('ttl_seconds', 3600)  # Default 1 hour
            await self.l2_redis.setex(cache_key, ttl, packed_data)
            
        except Exception as e:
            logger.error(f"L2 store error: {e}")
            raise
    
    async def _store_in_l3(self, cache_key: str, value: Any, metadata: Dict[str, Any]):
        """Store value in L3 SQLite cache"""
        def _store_sync():
            try:
                # Compress and serialize
                data_bytes, compressed = self.compression_manager.compress_data(value)
                
                with self.l3_lock:
                    with sqlite3.connect(self.l3_db_path) as conn:
                        conn.execute("""
                            INSERT OR REPLACE INTO cache_items 
                            (key, value, created_at, last_accessed, access_count, 
                             ttl_seconds, priority, size_bytes, compressed)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            cache_key,
                            data_bytes,
                            metadata['created_at'],
                            metadata['last_accessed'],
                            metadata['access_count'],
                            metadata['ttl_seconds'],
                            metadata['priority'],
                            metadata['size_bytes'],
                            int(compressed)
                        ))
                        conn.commit()
            except Exception as e:
                logger.error(f"L3 store error: {e}")
                raise
        
        await asyncio.get_event_loop().run_in_executor(
            self.executor, _store_sync
        )
    
    async def invalidate(self, key: str, params: Dict[str, Any] = None):
        """Invalidate cache entry across all levels"""
        cache_key = self._generate_cache_key(key, params)
        
        # Remove from L1
        if cache_key in self.l1_cache:
            del self.l1_cache[cache_key]
        
        # Remove from L2
        if self.l2_redis:
            try:
                await self.l2_redis.delete(cache_key)
            except Exception as e:
                logger.warning(f"L2 invalidation error: {e}")
        
        # Remove from L3
        def _invalidate_l3():
            with self.l3_lock:
                with sqlite3.connect(self.l3_db_path) as conn:
                    conn.execute("DELETE FROM cache_items WHERE key = ?", (cache_key,))
                    conn.commit()
        
        await asyncio.get_event_loop().run_in_executor(
            self.executor, _invalidate_l3
        )
        
        logger.debug(f"Invalidated cache for {key}")
    
    async def cleanup_expired(self):
        """Clean up expired cache entries"""
        current_time = time.time()
        
        # Clean L3 database
        def _cleanup_l3():
            with self.l3_lock:
                with sqlite3.connect(self.l3_db_path) as conn:
                    # Remove expired items
                    conn.execute("""
                        DELETE FROM cache_items 
                        WHERE ttl_seconds IS NOT NULL 
                        AND (created_at + ttl_seconds) < ?
                    """, (current_time,))
                    
                    # Clean up LRU items if database is too large
                    conn.execute("""
                        DELETE FROM cache_items 
                        WHERE key NOT IN (
                            SELECT key FROM cache_items 
                            ORDER BY priority DESC, last_accessed DESC 
                            LIMIT 50000
                        )
                    """)
                    
                    conn.commit()
        
        await asyncio.get_event_loop().run_in_executor(
            self.executor, _cleanup_l3
        )
        
        logger.info("Cache cleanup completed")
    
    async def preload_predictive_data(self):
        """Preload data based on predictive analysis"""
        if not self.predictive_manager:
            return
        
        candidates = self.predictive_manager.get_preload_candidates()
        logger.info(f"Preloading {len(candidates)} predicted cache items")
        
        # This would typically involve calling the data source
        # For now, we just log the candidates
        for candidate in candidates:
            logger.debug(f"Would preload: {candidate}")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache performance statistics"""
        return {
            'hit_rate': self.stats.hit_rate,
            'total_requests': self.stats.total_requests,
            'cache_hits': self.stats.cache_hits,
            'cache_misses': self.stats.cache_misses,
            'l1_hits': self.stats.l1_hits,
            'l2_hits': self.stats.l2_hits,
            'l3_hits': self.stats.l3_hits,
            'avg_response_time_ms': self.stats.avg_response_time_ms,
            'l1_cache_size': len(self.l1_cache),
            'l1_cache_capacity': self.l1_size
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on all cache layers"""
        health = {
            'l1_memory': {'status': 'healthy', 'size': len(self.l1_cache)},
            'l2_redis': {'status': 'unknown'},
            'l3_sqlite': {'status': 'unknown'}
        }
        
        # Check Redis
        if self.l2_redis:
            try:
                await self.l2_redis.ping()
                health['l2_redis']['status'] = 'healthy'
            except:
                health['l2_redis']['status'] = 'unhealthy'
        else:
            health['l2_redis']['status'] = 'disabled'
        
        # Check SQLite
        try:
            def _check_l3():
                with sqlite3.connect(self.l3_db_path) as conn:
                    cursor = conn.execute("SELECT COUNT(*) FROM cache_items")
                    return cursor.fetchone()[0]
            
            count = await asyncio.get_event_loop().run_in_executor(
                self.executor, _check_l3
            )
            health['l3_sqlite'] = {'status': 'healthy', 'item_count': count}
        except Exception as e:
            health['l3_sqlite'] = {'status': 'unhealthy', 'error': str(e)}
        
        return health

# Example usage for electrical estimation edge computing
class ElectricalCalculationCache:
    """Specialized cache for electrical calculations"""
    
    def __init__(self):
        self.cache = AdvancedEdgeCacheSystem(
            l1_size=5000,
            compression_threshold=512,
            enable_predictive=True
        )
    
    async def get_load_calculation(
        self, 
        area_sqft: float, 
        building_type: str, 
        voltage_system: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached load calculation result"""
        params = {
            'area_sqft': area_sqft,
            'building_type': building_type,
            'voltage_system': voltage_system
        }
        
        result, cache_level = await self.cache.get(
            'load_calculation', 
            params
        )
        
        if result:
            logger.info(f"Load calculation cache hit from {cache_level.value}")
        
        return result
    
    async def cache_load_calculation(
        self,
        area_sqft: float,
        building_type: str,
        voltage_system: str,
        result: Dict[str, Any],
        ttl_hours: int = 24
    ):
        """Cache load calculation result"""
        params = {
            'area_sqft': area_sqft,
            'building_type': building_type,
            'voltage_system': voltage_system
        }
        
        await self.cache.set(
            'load_calculation',
            result,
            params,
            ttl_seconds=ttl_hours * 3600,
            priority=2  # High priority for electrical calculations
        )
        
        logger.info("Load calculation result cached")
    
    async def get_material_pricing(
        self, 
        material_ids: List[str], 
        region: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached material pricing"""
        params = {
            'material_ids': sorted(material_ids),  # Sort for consistent caching
            'region': region
        }
        
        result, cache_level = await self.cache.get(
            'material_pricing',
            params
        )
        
        return result
    
    async def get_nec_compliance_result(
        self, 
        calculation_hash: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached NEC compliance result"""
        result, cache_level = await self.cache.get(
            f'nec_compliance_{calculation_hash}'
        )
        
        return result

async def main():
    """Example usage of advanced edge caching system"""
    
    # Initialize electrical calculation cache
    calc_cache = ElectricalCalculationCache()
    
    # Simulate electrical calculations with caching
    test_cases = [
        {'area_sqft': 2500, 'building_type': 'residential', 'voltage_system': '240V'},
        {'area_sqft': 5000, 'building_type': 'commercial', 'voltage_system': '208V_3phase'},
        {'area_sqft': 2500, 'building_type': 'residential', 'voltage_system': '240V'},  # Duplicate for cache hit
    ]
    
    for i, case in enumerate(test_cases):
        print(f"\nTest case {i+1}: {case}")
        
        # Try to get from cache
        cached_result = await calc_cache.get_load_calculation(**case)
        
        if cached_result:
            print(f"✓ Cache hit: {cached_result}")
        else:
            print("✗ Cache miss - calculating...")
            
            # Simulate calculation
            result = {
                'base_load_va': case['area_sqft'] * 3,
                'required_ampacity': (case['area_sqft'] * 3) / 240,
                'calculation_time_ms': 2.5,
                'cached_at': datetime.now().isoformat()
            }
            
            # Cache the result
            await calc_cache.cache_load_calculation(**case, result=result)
            print(f"✓ Calculated and cached: {result}")
    
    # Get performance statistics
    stats = calc_cache.cache.get_performance_stats()
    print(f"\nCache Performance:")
    print(f"Hit Rate: {stats['hit_rate']:.3f}")
    print(f"Average Response Time: {stats['avg_response_time_ms']:.2f}ms")
    print(f"L1 Hits: {stats['l1_hits']}")
    print(f"L2 Hits: {stats['l2_hits']}")
    print(f"L3 Hits: {stats['l3_hits']}")
    
    # Health check
    health = await calc_cache.cache.health_check()
    print(f"\nCache Health: {health}")
    
    # Cleanup
    await calc_cache.cache.cleanup_expired()

if __name__ == "__main__":
    asyncio.run(main())