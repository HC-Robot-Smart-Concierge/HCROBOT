from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "HC-Robot Concierge Backend"
    
    # PostgreSQL Configuration
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "Kha170205"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "hc_robot_db"
    DATABASE_URL: Optional[str] = None
    
    # ChromaDB Configuration
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    OBSIDIAN_VAULT_DIR: str = "./knowledge_vault"


    # Ollama Configuration
    OLLAMA_HOST: str = "http://localhost:11434"
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

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"), 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

    @property
    def sync_database_url(self) -> str:
        """Returns standard PostgreSQL connection URL (psycopg2) for admin tasks like DB creation."""
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def async_database_url(self) -> str:
        """Returns Async PostgreSQL connection URL (asyncpg)."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
