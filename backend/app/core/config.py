from typing import Optional
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "HC-Robot Concierge Backend"
    
    # PostgreSQL Configuration (loaded from .env)
    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "postgres"
    DATABASE_URL: Optional[str] = None
    IS_CLOUD_DB: bool = False
    
    # ChromaDB Configuration
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    OBSIDIAN_VAULT_DIR: str = "./knowledge_vault"


    # Ollama Configuration
    OLLAMA_HOST: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b-instruct"
    OLLAMA_EMBED_MODEL: str = "bge-m3"

    # AI Voice Concierge TTS Configuration
    TTS_PROVIDER: str = "edge"  # Options: 'edge', 'elevenlabs', 'openai', 'browser'
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_VOICE_ID: Optional[str] = "21m00Tcm4TlvDq8ikWAM"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_TTS_VOICE: str = "alloy"

    # Pipecat Realtime Audio Pipeline Configuration
    ENABLE_PIPECAT: bool = True
    PIPECAT_SAMPLE_RATE: int = 16000

    # Pi5 Camera Stream Configuration (MJPEG over SSH Tunnel)
    PI5_CAMERA_STREAM_URL: str = "http://localhost:8554/stream"

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"), 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

    @property
    def sync_database_url(self) -> str:
        """Returns standard PostgreSQL connection URL (psycopg2) for admin tasks."""
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def async_database_url(self) -> str:
        """Returns Async PostgreSQL connection URL (asyncpg)."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
