from fastapi import APIRouter, HTTPException
from db.mongo import get_rooms_collection
from bson import ObjectId

router = APIRouter(prefix="/rooms", tags=["Rooms"])

@router.get("/{room_id}")
async def get_room(room_id: str):
    rooms_coll = get_rooms_collection()
    # Handle if room_id is valid ObjectId or just a string
    try:
        obj_id = ObjectId(room_id) if len(room_id) == 24 else room_id
    except:
        obj_id = room_id

    room_doc = await rooms_coll.find_one({"_id": obj_id})
    
    if not room_doc:
        raise HTTPException(status_code=404, detail="Room not found.")
        
    room_doc["_id"] = str(room_doc["_id"])
    room_doc["diagram"] = str(room_doc.get("diagram", ""))
    room_doc["project"] = str(room_doc.get("project", ""))
    return room_doc
