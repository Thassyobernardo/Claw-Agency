import logging
import time
import json
from functools import wraps

# Structured Logger (Pattern 18: Observability)
def setup_structured_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "module": "%(name)s", "message": "%(message)s"}',
    )

class Telemetry:
    """Simple telemetery collector for multi-agent system."""
    _stats = {
        "tokens_estimate": 0,
        "api_latency": [],
        "agent_cycles": 0
    }

    @classmethod
    def track_latency(cls, duration: float):
        if not isinstance(cls._stats["api_latency"], list):
            cls._stats["api_latency"] = []
        cls._stats["api_latency"].append(duration)
        if len(cls._stats["api_latency"]) > 100:
            cls._stats["api_latency"].pop(0)

    @classmethod
    def log_event(cls, agent: str, event: str, metadata: dict = None):
        cls._stats["agent_cycles"] += 1
        log = logging.getLogger(f"Telemetry.{agent}")
        log.info(f"{event} - {json.dumps(metadata or {})}")

def time_it(agent_name: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            result = func(*args, **kwargs)
            duration = time.time() - start
            Telemetry.track_latency(duration)
            Telemetry.log_event(agent_name, f"Finished {func.__name__}", {"duration_ms": int(duration * 1000)})
            return result
        return wrapper
    return decorator
