import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Loader2,
  Save,
  Trash2,
  Check,
  X,
  MousePointer2,
  Settings,
  Type,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

const BASE = "http://localhost:8000";

// Helper for polygon SVG rendering
const toSvgPoints = (polygon, width, height) => {
  return polygon.map((p) => `${p.x * width},${p.y * height}`).join(" ");
};

function DrawingCanvas({ image, drawnRooms, setDrawnRooms }) {
  const containerRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [dims, setDims] = useState({ w: 1, h: 1 });

  // Dialog state for room name
  const [namingPolygon, setNamingPolygon] = useState(null);
  const [roomName, setRoomName] = useState("");
  const inputRef = useRef(null);

  // ResizeObserver to track container size for SVG rendering
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDims({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [image]);

  const getNormPos = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handleMouseMove = (e) => {
    if (points.length > 0 && !namingPolygon) {
      setMousePos(getNormPos(e));
    }
  };

  const handleClick = (e) => {
    if (namingPolygon) return;
    setPoints((prev) => [...prev, getNormPos(e)]);
  };

  const finishDrawing = useCallback(() => {
    if (points.length > 2) {
      setNamingPolygon(points);

      // Auto-focus input after a tiny tick
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
    setPoints([]);
    setMousePos(null);
  }, [points]);

  const cancelDrawing = useCallback(() => {
    setPoints([]);
    setMousePos(null);
    setNamingPolygon(null);
    setRoomName("");
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (namingPolygon) {
        if (e.key === "Escape") cancelDrawing();
        return;
      }
      if (e.key === "Enter" && points.length > 2) finishDrawing();
      if (e.key === "Escape") cancelDrawing();
    },
    [points.length, finishDrawing, cancelDrawing, namingPolygon],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const saveRoomName = () => {
    if (!namingPolygon) return;
    const name = roomName.trim() || `Room ${drawnRooms.length + 1}`;
    setDrawnRooms((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, polygon: namingPolygon },
    ]);
    setNamingPolygon(null);
    setRoomName("");
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-muted/30 overflow-hidden rounded-xl border border-border/50">
      {/* Container matched to image aspect ratio */}
      <div
        ref={containerRef}
        className="relative shadow-xl cursor-crosshair bg-white"
        style={{ maxWidth: "100%", maxHeight: "100%", display: "inline-block" }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        <img
          src={`${BASE}${image.url}`}
          alt={image.filename}
          className="max-w-full max-h-full object-contain block pointer-events-none"
          draggable={false}
        />

        {/* SVG Overlay for polygons */}
        <svg
          fill="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* Render already drawn rooms */}
          {drawnRooms.map((r, i) => (
            <g key={i}>
              <polygon
                points={toSvgPoints(r.polygon, dims.w, dims.h)}
                fill="rgb(139, 92, 246, 0.2)"
                stroke="rgb(139, 92, 246)"
                strokeWidth="2"
              />
              {/* Optional: label pos roughly at first point */}
              <text
                x={r.polygon[0].x * dims.w + 5}
                y={r.polygon[0].y * dims.h + 15}
                fill="white"
                className="text-xs font-semibold select-none drop-shadow-md"
                style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.8))" }}
              >
                {r.name}
              </text>
            </g>
          ))}

          {/* Render currently drawing polygon */}
          {points.length > 0 && (
            <>
              <polyline
                points={toSvgPoints(points, dims.w, dims.h)}
                fill="rgb(99, 102, 241, 0.1)"
                stroke="rgb(99, 102, 241)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              {/* Line to current mouse pos */}
              {mousePos && (
                <line
                  x1={points[points.length - 1].x * dims.w}
                  y1={points[points.length - 1].y * dims.h}
                  x2={mousePos.x * dims.w}
                  y2={mousePos.y * dims.h}
                  stroke="rgb(99, 102, 241)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}
            </>
          )}

          {/* Closing line if naming */}
          {namingPolygon && (
            <polygon
              points={toSvgPoints(namingPolygon, dims.w, dims.h)}
              fill="rgb(234, 179, 8, 0.2)"
              stroke="rgb(234, 179, 8)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}
        </svg>
      </div>

      {/* Name Dialog Overlay */}
      {namingPolygon && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card w-80 p-5 rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <Type className="h-4 w-4 text-violet-500" />
              Name this room
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Enter an identifier for this clipped section.
            </p>
            <Input
              ref={inputRef}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveRoomName()}
              placeholder="e.g. Master Bedroom"
              className="mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={cancelDrawing}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveRoomName}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Save mask
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoomSeparatorTab({ project }) {
  const images = project?.selected_diagram_metadata?.images || [];
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [sessionRooms, setSessionRooms] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedImage = images[selectedIdx];
  const currentFileName = selectedImage?.filename;

  // Initialize from backend source of truth if available
  useEffect(() => {
    if (
      currentFileName &&
      !sessionRooms[currentFileName] &&
      selectedImage?.rooms
    ) {
      setSessionRooms((prev) => ({
        ...prev,
        [currentFileName]: selectedImage.rooms.map((r) => ({
          ...r,
          polygon: r.mask_array, // rename map mapping back from backend structure
          isSaved: true,
        })),
      }));
    }
  }, [currentFileName, selectedImage, sessionRooms]);

  const currentDrawnRooms = sessionRooms[currentFileName] || [];

  const setCurrentDrawnRooms = (updater) => {
    setSessionRooms((prev) => ({
      ...prev,
      [currentFileName]:
        typeof updater === "function"
          ? updater(prev[currentFileName] || [])
          : updater,
    }));
  };

  const removeDrawnRoom = async (idx) => {
    const room = currentDrawnRooms[idx];
    if (room.isSaved && room.id) {
      try {
        setError("");
        const res = await fetch(
          `${BASE}/projects/${project._id || project.id}/rooms/${room.id}?image_filename=${encodeURIComponent(currentFileName)}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok) throw new Error("Failed to delete room from server");
      } catch (err) {
        setError(err.message);
        return; // Halt if API removal fails
      }
    }
    setCurrentDrawnRooms((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveToBackend = async () => {
    if (Object.keys(sessionRooms).length === 0) return;
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      // Find the URL, send rooms
      // We process one image at a time or batch? The UI mostly encourages one image.
      // Let's just process the current image's rooms
      if (currentDrawnRooms.length === 0) {
        throw new Error("No rooms drawn for this image.");
      }

      // Try parsing seq from filename (e.g. projectid_pagenum_seq.png)
      // Defaults to 'a'
      const parts = selectedImage.filename.split("_");
      let parsedSeq = "a";
      if (parts.length > 2) {
        parsedSeq = parts[2].split(".")[0];
      }

      const pageNum = selectedImage.page_num || selectedImage.page_number || 1;

      const payload = {
        image_url: selectedImage.url,
        filename: selectedImage.filename,
        page_number: pageNum,
        diagram_seq: selectedImage.diagram_seq || parsedSeq,
        rooms: currentDrawnRooms,
      };

      const res = await fetch(
        `${BASE}/projects/${project._id || project.id}/rooms/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to extract rooms");

      setSuccessMsg(
        `Successfully saved and extracted ${data.rooms.length} room(s)!`,
      );
      // Clear session rooms for this image to show task complete
      setCurrentDrawnRooms([]);
      // Hide success message after a few seconds
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!images.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <MousePointer2 className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">
          No images available
        </h3>
        <p className="text-sm">
          Please select and save images in the Source tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT: Tools & List */}
      <div className="w-72 border-r border-border/50 bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border/50">
          <h2 className="text-sm font-semibold mb-3 tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-4 bg-violet-500 rounded-full" />
            Floorplan Selector
          </h2>
          <select
            className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
          >
            {images.map((img, i) => (
              <option key={i} value={i}>
                Page {img.page_num || img.page_number} - {img.label || "full"} (
                {img.filename.slice(0, 10)}...)
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="bg-muted/30 rounded-lg p-3 border border-border/50 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-1">Instructions:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Click on the image to place polygon points.</li>
              <li>
                Press <strong>Enter</strong> to complete the shape.
              </li>
              <li>Name the room in the popup that appears.</li>
              <li>
                Press <strong>Esc</strong> to cancel drawing.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex justify-between">
              Drawn Rooms
              <span className="bg-muted text-foreground px-1.5 rounded">
                {currentDrawnRooms.length}
              </span>
            </h3>

            {currentDrawnRooms.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 italic py-2">
                No rooms drawn yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {currentDrawnRooms.map((r, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-card border border-border/60 px-2.5 py-1.5 rounded-lg group"
                  >
                    <span
                      className="text-xs font-medium truncate flex-1"
                      title={r.name}
                    >
                      {r.name}
                    </span>
                    <button
                      onClick={() => removeDrawnRoom(i)}
                      className="text-muted-foreground/40 hover:text-red-500 transition-colors shrink-0 px-1 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border/50 bg-background/50 flex flex-col gap-2">
          {error && (
            <p className="text-xs text-red-500 text-center font-medium leading-tight">
              {error}
            </p>
          )}
          {successMsg && (
            <p className="text-xs text-emerald-500 text-center font-medium leading-tight">
              {successMsg}
            </p>
          )}

          <Button
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
            disabled={currentDrawnRooms.length === 0 || saving}
            onClick={handleSaveToBackend}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Extract {currentDrawnRooms.length} Room(s)
          </Button>
        </div>
      </div>

      {/* RIGHT: Canvas */}
      <div className="flex-1 p-6 relative bg-sidebar-accent/50 flex flex-col items-center justify-center">
        {selectedImage && (
          <DrawingCanvas
            image={selectedImage}
            drawnRooms={currentDrawnRooms}
            setDrawnRooms={setCurrentDrawnRooms}
          />
        )}
      </div>
    </div>
  );
}
