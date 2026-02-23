from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, MONGO_DB_NAME

# Single shared client (created once at startup)
_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[MONGO_DB_NAME]


def get_projects_collection():
    return get_db()["projects"]
