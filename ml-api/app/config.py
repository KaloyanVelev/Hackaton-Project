from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://streetaware:streetaware_dev@localhost:5432/streetaware"
    LLM_BASE_URL: str = "http://host.docker.internal:11434/v1"
    LLM_MODEL: str = "qwen3.5:9b"
    LLM_API_KEY: str = "local"


settings = Settings()
