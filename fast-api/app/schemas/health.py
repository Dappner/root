from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str = "2.0.0"
