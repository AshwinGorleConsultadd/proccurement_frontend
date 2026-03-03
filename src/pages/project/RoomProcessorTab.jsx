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
  CheckCircle2,
  Loader2,
  ReceiptText,
  Loader2,
  Check,
  XCircle,
} from "lucide-react";
import { api } from "../../redux/api/apiClient";
import { useProjects } from "../../redux/hooks/project/useProjects";
import { useNavigate } from "react-router-dom";

const BASE = "http://localhost:8000";

/* ══════════════════════════════════════════════════════════════════════════
   LIGHTBOX — full-screen image viewer
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
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <span className="text-white text-xl leading-none">&times;</span>
      </button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono bg-white/10 rounded-full px-3 py-1">
        {idx + 1} / {images.length}
      </div>
      {hasPrev && (
        <button
          onClick={() => setIdx((i) => i - 1)}
          className="absolute left-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}
      <div className="max-w-[90vw] max-h-[86vh] flex flex-col items-center gap-3">
        <img
          key={url}
          src={url}
          alt={img.name || img.filename}
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
            <ExternalLink className="h-3 w-3" /> Open original
          </a>
        </div>
      </div>
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

/* ══════════════════════════════════════════════════════════════════════════
   Per-room Process button with budget auto-populate logic
══════════════════════════════════════════════════════════════════════════ */
function RoomCard({ room, pageNum, projectId, onDoubleClick }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");

  const url = room.url ? `${BASE}${room.url}` : "";

  const handleProcess = async (e) => {
    e.stopPropagation();
    if (state === "done") return; // already processed — don't duplicate

    setState("loading");
    setErrorMsg("");
    try {
      // Create a budget item for this room
      const payload = {
        spec_no: "", // to be filled by user
        vendor: "TBD",
        vendor_description: "",
        description: room.name, // room name as description
        room_name: room.name,
        room_id: room.id || "",
        page_no: Number(pageNum) || null,
        page_id: String(pageNum),
        qty: "1 Ea.",
        unit_cost: null, // to be filled by user
        section: "general",
        pdf_filename: room.filename || null,
      };

      await api.post(`/budget/${projectId}/item`, payload);
      setState("done");
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || "Failed");
      setState("error");
    }
  };

  return (
    <div
      className="relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 border-2 select-none flex flex-col border-border hover:border-violet-400/60 hover:shadow-md"
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick();
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
          <>
            <img
              src={url}
              alt={room.name}
              className="object-contain w-full h-full p-1 transition-transform duration-200 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling.style.display = "flex";
              }}
            />
            <div className="hidden flex-col items-center gap-1 text-muted-foreground/40 absolute inset-0 bg-muted items-center justify-center">
              <ImageOff className="h-8 w-8" />
              <span className="text-[10px]">Not found</span>
            </div>
          </>
        )}

        {/* Double-click hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
            <ZoomIn className="h-3 w-3 text-white/70" />
            <span className="text-[10px] text-white/70 font-medium">
              double-click
            </span>
          </div>
        </div>

        {/* Done badge */}
        {state === "done" && (
          <div className="absolute top-2 left-2 bg-emerald-500 text-white rounded-full px-2 py-0.5 flex items-center gap-1 text-[10px] font-semibold shadow">
            <CheckCircle2 className="h-3 w-3" /> Added to Budget
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2 border-t flex flex-col justify-between gap-2 min-w-0 bg-card border-border/50 h-[80px]">
        <span
          className="flex-1 min-w-0 text-[12px] font-semibold font-mono truncate leading-tight text-foreground/80 whitespace-normal"
          title={room.name}
        >
          {room.name}
        </span>

        {state === "error" && (
          <p className="text-[10px] text-red-500 truncate">{errorMsg}</p>
        )}

        <Button
          size="sm"
          className={`w-full gap-2 text-xs h-7 ${
            state === "done"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-violet-600 hover:bg-violet-700"
          }`}
          disabled={state === "loading" || state === "done"}
          onClick={handleProcess}
        >
          {state === "loading" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
            </>
          ) : state === "done" ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Added to Budget
            </>
          ) : (
            <>
              <ReceiptText className="h-3.5 w-3.5" /> Add to Budget
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN TAB
══════════════════════════════════════════════════════════════════════════ */
export function RoomProcessorTab({ project }) {
  // Only render if we have available extracted rooms from saved pages
  const images = project?.diagrams || [];
  const projectId = project?._id ?? project?.id ?? "";

  const groupedRooms = useMemo(() => {
    const groups = {};
    images.forEach((img) => {
      const pageNum = img.page_num || img.page_number || "Unknown Page";
      if (!groups[pageNum]) groups[pageNum] = [];
      if (img.rooms && Array.isArray(img.rooms)) {
        groups[pageNum].push(...img.rooms);
      }
    });
    Object.keys(groups).forEach((key) => {
      if (groups[key].length === 0) delete groups[key];
    });
    return groups;
  }, [images]);

  const [lightboxState, setLightboxState] = useState(null);

  const openLightbox = (roomsArray, clickedRoomId) => {
    const idx = roomsArray.findIndex(
      (r) => r.id === clickedRoomId || r.name === clickedRoomId,
    );
    setLightboxState({ images: roomsArray, startIndex: Math.max(0, idx) });
  };

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

  const navigate = useNavigate();
  const { loadOne } = useProjects();
  const [pollingRooms, setPollingRooms] = useState(new Set());
  const [roomStatus, setRoomStatus] = useState({});

  const handleProcessRoom = async (roomId, roomName) => {
    try {
      // Update UI immediately
      setRoomStatus((prev) => ({
        ...prev,
        [roomId]: { status: "pending", progress: 0 },
      }));
      setPollingRooms((prev) => new Set(prev).add(roomId));

      const res = await fetch(
        `${BASE}/projects/${project._id || project.id}/rooms/${roomId}/analyze`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to start analysis");
    } catch (err) {
      console.error(err);
      setRoomStatus((prev) => ({
        ...prev,
        [roomId]: { status: "error", progress: 0, error: err.message },
      }));
    }
  };

  // Polling Effect
  useEffect(() => {
    if (pollingRooms.size === 0) return;

    const interval = setInterval(async () => {
      for (const roomId of pollingRooms) {
        try {
          const res = await fetch(
            `${BASE}/projects/${project._id || project.id}/rooms/${roomId}/analysis-status`,
          );
          if (res.ok) {
            const data = await res.json();

            setRoomStatus((prev) => ({
              ...prev,
              [roomId]: { status: data.status, progress: data.progress },
            }));

            if (data.status === "completed" || data.status === "error") {
              setPollingRooms((prev) => {
                const updated = new Set(prev);
                updated.delete(roomId);
                return updated;
              });
              if (data.status === "completed") {
                loadOne(project._id || project.id); // Reload full project upon completion
              }
            }
          }
        } catch (e) {
          console.error("Poll error for", roomId, e);
        }
      }
    }, 2500); // Check every 2.5 seconds

    return () => clearInterval(interval);
  }, [pollingRooms, project._id, project.id, loadOne]);

  const [lightboxState, setLightboxState] = useState(null);

  const openLightbox = (roomsArray, clickedRoomId) => {
    const idx = roomsArray.findIndex(
      (r) => r.id === clickedRoomId || r.name === clickedRoomId,
    );
    setLightboxState({ images: roomsArray, startIndex: Math.max(0, idx) });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Info banner */}
      <div className="shrink-0 bg-violet-500/5 border-b border-violet-500/15 px-6 py-3 flex items-center gap-3">
        <ReceiptText className="h-4 w-4 text-violet-400 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Click <strong>"Add to Budget"</strong> on each room to auto-create a
          budget line item. Then go to the <strong>Budget tab</strong> to fill
          in Spec No, Vendor, Qty, and Unit Cost.
        </p>
      </div>

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

                    <div className="px-2.5 py-2 border-t flex flex-col justify-between gap-2 min-w-0 bg-card border-border/50 h-[80px]">
                      <span
                        className="flex-1 min-w-0 text-[12px] font-semibold font-mono truncate leading-tight text-foreground/80 whitespace-normal"
                        title={room.name}
                      >
                        {room.name}
                      </span>
                      {(() => {
                        // Priority: 1. local tracked status 2. backed mongo status 3. default structure
                        const local = roomStatus[room.id || room.name];
                        const status = local
                          ? local.status
                          : room.analysis_status || "idle";
                        const progress = local
                          ? local.progress
                          : room.analysis_progress || 0;

                        if (
                          status === "idle" ||
                          status === "error" ||
                          !status
                        ) {
                          return (
                            <Button
                              size="sm"
                              className={`w-full gap-2 text-xs h-7 ${status === "error" ? "bg-red-600 hover:bg-red-700" : "bg-violet-600 hover:bg-violet-700"}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProcessRoom(room.id, room.name);
                              }}
                            >
                              {status === "error" ? (
                                <XCircle className="h-3.5 w-3.5" />
                              ) : (
                                <Cpu className="h-3.5 w-3.5" />
                              )}
                              {status === "error" ? "Retry" : "Process"}
                            </Button>
                          );
                        } else if (status === "completed") {
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-2 text-xs h-7 border-emerald-500/50 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/editor/${room.id || room._id || room.name}`,
                                );
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Go to Editor
                            </Button>
                          );
                        } else {
                          // Processing (pending/preprocessing/generating_masks/etc)
                          return (
                            <div className="flex flex-col gap-1 w-full justify-center">
                              <div className="flex items-center gap-2 justify-between px-1">
                                <span className="text-[10px] uppercase font-mono text-muted-foreground truncate">
                                  {status.replace("_", " ")}
                                </span>
                                <span className="text-[10px] font-mono font-medium">
                                  {progress}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-violet-500 transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          );
                        }
                      })()}
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
