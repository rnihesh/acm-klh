from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "gstrecon2026"

    # LLM Keys
    openai_api_key: str = ""
    gemini_api_key: str = ""
    ollama_url: str = "http://localhost:11434"
    llm_priority: str = "openai,gemini,ollama"

    # App
    app_name: str = "GST Reconciliation Engine"
    debug: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
