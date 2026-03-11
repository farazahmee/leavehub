r"""
Development server runner.
Run with: venv\Scripts\python.exe run.py (or activate venv first, then python run.py)
"""
import uvicorn
from core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level="info"
    )
