import React, { useMemo, useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import {
  CopyPlus,
  Cpu,
  FolderOpen,
  MousePointer2,
  ZoomIn,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const BASE = "http://localhost:8000";

/* ══════════════════════════════════════════════════════════════════════════
   LIGHTBOX — full-screen image viewer, opened on double-click
══════════════════════════════════════════════════════════════════════════ */
function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const img = images[idx];
  const url = `${BASE}${img.url}`;
  const hasPrev = idx > 0;
  const hasNext = idx < images.length - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <span className="text-white text-xl leading-none">&times;</span>
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono bg-white/10 rounded-full px-3 py-1">
        {idx + 1} / {images.length}
      </div>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={() => setIdx((i) => i - 1)}
          className="absolute left-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Image */}
      <div className="max-w-[90vw] max-h-[86vh] flex flex-col items-center gap-3">
        <img
          key={url}
          src={url}
          alt={img.filename}
          className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
        />
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs font-mono bg-white/[0.08] rounded-full px-3 py-1">
            {img.name || img.filename}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Open original
          </a>
        </div>
      </div>

      {/* Next */}
      {hasNext && (
        <button
          onClick={() => setIdx((i) => i + 1)}
          className="absolute right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
  );
}

export function RoomProcessorTab({ project }) {
  const images = project?.selected_diagram_metadata?.images || [];

  // Group rooms by their page number.
  // We'll iterate the images array and collect the rooms within them.
  const groupedRooms = useMemo(() => {
    const groups = {};
    images.forEach((img) => {
      const pageNum = img.page_num || img.page_number || "Unknown Page";
      if (!groups[pageNum]) {
        groups[pageNum] = [];
      }
      if (img.rooms && Array.isArray(img.rooms)) {
        groups[pageNum].push(...img.rooms);
      }
    });

    // Clean up empty groups
    Object.keys(groups).forEach((key) => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }, [images]);

  if (Object.keys(groupedRooms).length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <MousePointer2 className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">
          No Rooms Extracted yet
        </h3>
        <p className="text-sm">
          Use the Room Separator tab to cut and save rooms from your pages
          first.
        </p>
      </div>
    );
  }

  const handleProcessRoom = (roomId, roomName) => {
    // Note: Dummy handler for now per instructions
    console.log(
      `Triggering processing for room ID: ${roomId}, Name: ${roomName}`,
    );
    alert(`Processing pipeline initiated for "${roomName}". (Placeholder)`);
  };

  const [lightboxState, setLightboxState] = useState(null);

  const openLightbox = (roomsArray, clickedRoomId) => {
    const idx = roomsArray.findIndex(
      (r) => r.id === clickedRoomId || r.name === clickedRoomId,
    );
    setLightboxState({ images: roomsArray, startIndex: Math.max(0, idx) });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {Object.entries(groupedRooms).map(([pageNum, rooms]) => (
          <div key={pageNum} className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2 border-b border-border/50 pb-2">
              <span className="h-5 w-5 rounded bg-violet-500/10 flex items-center justify-center">
                <FolderOpen className="h-3 w-3 text-violet-500" />
              </span>
              Page {pageNum}
              <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {rooms.length} room{rooms.length !== 1 ? "s" : ""}
              </span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rooms.map((room) => {
                const url = room.url ? `${BASE}${room.url}` : "";
                return (
                  <div
                    key={room.id || room.name}
                    className="relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 border-2 select-none flex flex-col border-border hover:border-violet-400/60 hover:shadow-md"
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      openLightbox(rooms, room.id || room.name);
                    }}
                  >
                    {/* Image area */}
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                      {!url ? (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
                          <ImageOff className="h-8 w-8" />
                          <span className="text-[10px]">Not found</span>
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt={room.name}
                          className="object-contain w-full h-full p-1 transition-transform duration-200 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling.style.display =
                              "flex";
                          }}
                        />
                      )}
                      {/* Fallback visible on error (hidden initially) */}
                      <div className="hidden flex-col items-center gap-1 text-muted-foreground/40 absolute inset-0 bg-muted items-center justify-center">
                        <ImageOff className="h-8 w-8" />
                        <span className="text-[10px]">Not found</span>
                      </div>

                      {/* Double-click hint */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                          <ZoomIn className="h-3 w-3 text-white/70" />
                          <span className="text-[10px] text-white/70 font-medium">
                            double-click
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-2.5 py-2 border-t flex flex-col justify-between gap-2 min-w-0 bg-card border-border/50 h-[80px]">
                      <span
                        className="flex-1 min-w-0 text-[12px] font-semibold font-mono truncate leading-tight text-foreground/80 whitespace-normal"
                        title={room.name}
                      >
                        {room.name}
                      </span>
                      <Button
                        size="sm"
                        className="w-full gap-2 text-xs h-7 bg-violet-600 hover:bg-violet-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessRoom(room.id, room.name);
                        }}
                      >
                        <Cpu className="h-3.5 w-3.5" />
                        Process
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {lightboxState && (
        <Lightbox
          images={lightboxState.images}
          startIndex={lightboxState.startIndex}
          onClose={() => setLightboxState(null)}
        />
      )}
    </div>
  );
}
