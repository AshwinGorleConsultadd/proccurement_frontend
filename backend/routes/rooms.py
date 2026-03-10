from fastapi import APIRouter, HTTPException
from db.mongo import get_rooms_collection
from bson import ObjectId
from pydantic import BaseModel

class RoomCreate(BaseModel):
    name: str
    notes: str = ""
    created_by: str = "user"

router = APIRouter(prefix="/rooms", tags=["Rooms"])

@router.get("/project/{project_id}")
async def get_rooms_by_project(project_id: str):
    rooms_coll = get_rooms_collection()
    cursor = rooms_coll.find({"project": project_id})
    docs = await cursor.to_list(1000)
    for d in docs:
        d["_id"] = str(d["_id"])
        if "diagram" in d:
            d["diagram"] = str(d.get("diagram", ""))
        if "project" in d:
            d["project"] = str(d.get("project", ""))
    return docs

@router.post("/project/{project_id}", status_code=201)
async def create_room(project_id: str, body: RoomCreate):
    rooms_coll = get_rooms_collection()
    new_room = {
        "project": project_id,
        "name": body.name,
        "notes": body.notes,
        "created_by": body.created_by
    }
    res = await rooms_coll.insert_one(new_room)
    new_room["_id"] = str(res.inserted_id)
    return new_room

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
