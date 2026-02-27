from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

_backend_dir = Path(__file__).resolve().parent.parent
_env_paths = [_backend_dir / ".env", _backend_dir.parent / ".env"]
_env_file = next((p for p in _env_paths if p.exists()), ".env")


class Settings(BaseSettings):
    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "gstrecon2026"

    # LLM Keys
    openai_api_key: str = ""
    gemini_api_key: str = ""
    ollama_url: str = "http://165.245.128.29:11434"
    llm_priority: str = "openai,gemini,ollama"

    # JWT Auth
    jwt_secret: str = "gst-recon-hackathon-secret-2026"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # App
    app_name: str = "GST Reconciliation Engine"
    debug: bool = True

    class Config:
        env_file = str(_env_file)
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
