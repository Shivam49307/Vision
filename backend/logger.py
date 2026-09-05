import sys
from pathlib import Path
from loguru import logger

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logger.remove()

# Console — colored, human-readable
logger.add(
    sys.stdout,
    colorize=True,
    diagnose=False,
    level="INFO",
    format=(
        "<green>{time:HH:mm:ss}</green> | "
        "<level>{level:<8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan> | "
        "<level>{message}</level>"
    ),
)

# File — full detail, auto-rotated
logger.add(
    LOG_DIR / "app_{time:YYYY-MM-DD}.log",
    diagnose=False,
    level="DEBUG",
    rotation="00:00",
    retention="1 day",
    compression="zip",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} | {message}",
)
