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

def get_project_sources_collection():
    return get_db()["project_sources"]

def get_pages_collection():
    return get_db()["pages"]

def get_diagrams_collection():
    return get_db()["diagrams"]

def get_rooms_collection():
    return get_db()["rooms"]
