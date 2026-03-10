import asyncio
import os
import sys

# Ensure backend directory is in the path to allow imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(".env")

from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, MONGO_DB_NAME
from bson import ObjectId
import datetime
from services.budget_service import create_item

PROJECT_ID = "69a616af4d6ec36cfb42cbf2"

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    rooms_col = db["rooms"]
    budget_col = db["budget_items"]

    print(f"Connecting to MongoDB at {MONGO_URI} / {MONGO_DB_NAME}")

    # Clean existing data for this project (optional, but good for resetting demo data)
    await budget_col.delete_many({"project": PROJECT_ID})

    # Find or Create Rooms
    room_names = ["Lobby Lounge", "Meeting Room", "Restrooms", "Leasing Office"]
    room_map = {}
    
    for r_name in room_names:
        existing = await rooms_col.find_one({"project": PROJECT_ID, "name": r_name})
        if existing:
            room_map[r_name] = str(existing["_id"])
        else:
            res = await rooms_col.insert_one({
                "project": PROJECT_ID,
                "name": r_name,
                "notes": "Created via demo script"
            })
            room_map[r_name] = str(res.inserted_id)
            print(f"Created room: {r_name} -> {res.inserted_id}")

    # Build Budget Items list
    items = [
        # Lobby Lounge
        {"room": room_map["Lobby Lounge"], "spec_no": "CH-108.A", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 300.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "CH-104", "description": "Lobby Lounge", "qty": "2 Ea.", "unit_cost": 750.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-105", "description": "Lobby Lounge", "qty": "2 Ea.", "unit_cost": 450.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "CH-106", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 800.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-107", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 250.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-103", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 850.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-101", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 900.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "CH-101", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 1200.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-102", "description": "Lobby Lounge", "qty": "2 Ea.", "unit_cost": 350.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "CH-102", "description": "Lobby Lounge", "qty": "2 Ea.", "unit_cost": 650.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-104", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 1200.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-106", "description": "Lobby Lounge", "qty": "1 Ea.", "unit_cost": 300.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "CH-103", "description": "Lobby Lounge", "qty": "2 Ea.", "unit_cost": 500.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "WT-101", "description": "Lobby Lounge", "qty": "2 Ea.", "unit_cost": 200.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "CH-105", "description": "Lobby Lounge", "qty": "6 Ea.", "unit_cost": 300.0, "page_no": 1},
        {"room": room_map["Lobby Lounge"], "spec_no": "TC-109", "description": "Lobby Lounge", "qty": "3 Ea.", "unit_cost": 600.0, "page_no": 1},
        
        # Meeting Room
        {"room": room_map["Meeting Room"], "spec_no": "CH-110", "description": "Meeting Room", "qty": "4 Ea.", "unit_cost": 450.0, "page_no": 2},
        {"room": room_map["Meeting Room"], "spec_no": "TC-110", "description": "Meeting Room", "qty": "1 Ea.", "unit_cost": 1500.0, "page_no": 2},

        # Leasing Office
        {"room": room_map["Leasing Office"], "spec_no": "CH-112", "description": "Leasing Office", "qty": "1 Ea.", "unit_cost": 450.0, "page_no": 4},
        {"room": room_map["Leasing Office"], "spec_no": "CH-113", "description": "Leasing Office", "qty": "2 Ea.", "unit_cost": 350.0, "page_no": 4},
        {"room": room_map["Leasing Office"], "spec_no": "TC-113", "description": "Leasing Office", "qty": "1 Ea.", "unit_cost": 800.0, "page_no": 4},
    ]

    print(f"Creating {len(items)} budget items...")
    
    # Needs a mock context if `create_item` depends on FastAPI DB config
    # Actually, `services/budget_service._col()` defaults to `db.mongo.get_db()`
    # We must ensure `db.mongo` gets our client.
    from db.mongo import get_client, _client
    import db.mongo
    db.mongo._client = client

    for i, data in enumerate(items):
        await create_item(PROJECT_ID, data)

    print("Successfully seeded demo data!")

if __name__ == "__main__":
    asyncio.run(main())
