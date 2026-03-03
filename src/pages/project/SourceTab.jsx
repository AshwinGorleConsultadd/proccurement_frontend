import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useProjects } from "../../redux/hooks/project/useProjects";
import { Button } from "../../components/ui/button";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageOff,
  ZoomIn,
  ChevronDown,
  Upload,
  Loader2,
  Images,
  RefreshCw,
  Plus,
  CheckSquare,
  Square,
  Download,
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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
      >
        <X className="h-5 w-5 text-white" />
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
            {img.label || img.filename}
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

/* ══════════════════════════════════════════════════════════════════════════
   THUMB CARD — single image tile
   • single-click  → toggle select
   • double-click  → open lightbox
══════════════════════════════════════════════════════════════════════════ */
function ThumbCard({ img, mode, checked, onToggle, onDoubleClick }) {
  const [err, setErr] = useState(false);
  const url = `${BASE}${img.url}`;

  return (
    <div
      onClick={onToggle}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick?.();
      }}
      title={`${img.filename}\n(double-click to view full size)`}
      className={`relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 border-2 select-none flex flex-col
                ${
                  checked
                    ? mode === "remove"
                      ? "border-red-500 shadow-lg shadow-red-500/20 ring-2 ring-red-500/30"
                      : "border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30"
                    : "border-border hover:border-violet-400/60 hover:shadow-md"
                }`}
    >
      {/* Image area */}
      <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden relative">
        {err ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
            <ImageOff className="h-8 w-8" />
            <span className="text-[10px]">Not found</span>
          </div>
        ) : (
          <img
            src={url}
            alt={img.filename}
            className="object-contain w-full h-full p-1 transition-transform duration-200 group-hover:scale-105"
            onError={() => setErr(true)}
          />
        )}

        {/* Double-click hint — inside image so it doesn't push layout */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
            <ZoomIn className="h-3 w-3 text-white/70" />
            <span className="text-[10px] text-white/70 font-medium">
              double-click
            </span>
          </div>
        </div>

        {/* Select indicator */}
        <div className="absolute top-2 right-2">
          <div
            className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shadow-sm transition-all duration-150
                        ${
                          checked
                            ? mode === "remove"
                              ? "bg-red-500 border-red-500"
                              : "bg-emerald-500 border-emerald-500"
                            : "bg-background/80 border-border group-hover:border-violet-400/60"
                        }`}
          >
            {checked && (
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer: filename + label — always visible below image ── */}
      <div
        className={`px-2.5 py-2 border-t flex items-center gap-1.5 min-w-0 transition-colors
                ${
                  checked
                    ? mode === "remove"
                      ? "bg-red-50 dark:bg-red-950/30 border-red-200/50"
                      : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50"
                    : "bg-card border-border/50"
                }`}
      >
        {/* Filename — monospace, truncates with full name in tooltip */}
        <span
          className={`flex-1 min-w-0 text-[11px] font-semibold font-mono truncate leading-none
                        ${
                          checked
                            ? mode === "remove"
                              ? "text-red-700 dark:text-red-300"
                              : "text-emerald-700 dark:text-emerald-300"
                            : "text-foreground/80"
                        }`}
          title={img.filename}
        >
          {img.filename}
        </span>

        {/* Label badge */}
        <span
          className={`shrink-0 text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 leading-none border
                    ${
                      img.label && img.label !== "full"
                        ? "bg-violet-500/10 text-violet-500 border-violet-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                    }`}
        >
          {img.label || "full"}
        </span>
      </div>
    </div>
  );
}

/* ── Collapsible page group ─────────────────────────────────────────────── */
function PageGroup({
  page,
  images,
  mode,
  checked,
  onToggle,
  onImageDoubleClick,
}) {
  const [open, setOpen] = useState(true);
  const checkedCount = images.filter((img) => checked[img.filename]).length;
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">Page {page}</span>
          <span className="text-xs text-muted-foreground">
            {images.length} image{images.length !== 1 ? "s" : ""}
          </span>
        </div>
        {checkedCount > 0 && (
          <span
            className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border
                        ${
                          mode === "remove"
                            ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50"
                            : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50"
                        }`}
          >
            {checkedCount} marked
          </span>
        )}
      </button>
      {open && (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {images.map((img, i) => (
            <ThumbCard
              key={img.filename}
              img={img}
              mode={mode}
              checked={!!checked[img.filename]}
              onToggle={() => onToggle(img.filename)}
              onDoubleClick={() => onImageDoubleClick(images, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Upload drop zone for external images ───────────────────────────────── */
function UploadZone({ projectId, onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const fileRef = useRef(null);
  const [error, setError] = useState("");

  const doUpload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    let uploaded = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("page_number", pageNum);
      fd.append("label", "UPLOADED");
      try {
        const res = await fetch(`${BASE}/projects/${projectId}/upload-image`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(await res.text());
        uploaded++;
      } catch (e) {
        setError(e.message);
      }
    }
    setUploading(false);
    if (uploaded > 0) onUploaded();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    doUpload(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Upload className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold">Upload from your computer</p>
          <p className="text-xs text-muted-foreground">
            Drag &amp; drop or click to browse — PNG, JPG, WEBP
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">
            Page&nbsp;
          </label>
          <input
            type="number"
            min={1}
            value={pageNum}
            onChange={(e) => setPageNum(Number(e.target.value) || 1)}
            className="w-16 text-xs text-center rounded-lg border border-border bg-background px-2 py-1 focus:outline-none focus:border-violet-400/60"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 border-violet-500/25 text-violet-500 hover:bg-violet-500/10"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Browse Files
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => doUpload(Array.from(e.target.files))}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center py-10 gap-2 transition-colors cursor-pointer
                    ${dragging ? "bg-violet-500/10" : "hover:bg-muted/40"}`}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </>
        ) : (
          <>
            <div
              className={`h-12 w-12 rounded-2xl border-2 flex items-center justify-center transition-colors ${dragging ? "border-violet-400 bg-violet-500/15" : "border-dashed border-border"}`}
            >
              <Upload
                className={`h-6 w-6 transition-colors ${dragging ? "text-violet-400" : "text-muted-foreground/40"}`}
              />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {dragging ? "Drop images here" : "Drop image files here"}
            </p>
            <p className="text-xs text-muted-foreground/50">
              Supports PNG, JPG, JPEG, WEBP, GIF
            </p>
          </>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SOURCE TAB  (formerly "Editor")
   – Saved Pages / Add Pages sub-tabs
   – Double-click opens full-screen Lightbox
   – Upload from computer in Add Pages
══════════════════════════════════════════════════════════════════════════ */
export function SourceTab({ project }) {
  const {
    availablePages,
    availableLoading,
    loadOne,
    loadAvailablePages,
    clearPages,
    downloadMetadata,
  } = useProjects();

  const [subTab, setSubTab] = useState("saved");
  const [marked, setMarked] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const id = project._id ?? project.id;

  // ── Saved images come directly from MongoDB project document ──────────
  const savedImages =
    project.diagrams || project.selected_diagram_metadata?.images || [];

  // ── Available images still fetched from backend (all in sectioned/) ───
  const allData = availablePages[id];
  useEffect(() => {
    if (subTab === "add" && !allData) loadAvailablePages(id);
  }, [subTab, id, allData, loadAvailablePages]);
  useEffect(() => {
    return () => clearPages(id);
  }, [id, clearPages]);
  useEffect(() => {
    setMarked({});
  }, [subTab]);

  const toggleMark = (fn) =>
    setMarked((prev) => ({ ...prev, [fn]: !prev[fn] }));
  const markedList = Object.entries(marked)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const hasMarked = markedList.length > 0;
  const allImages = allData?.images ?? [];
  const savedFilenames = useMemo(
    () => new Set(savedImages.map((i) => i.filename)),
    [savedImages],
  );
  const addableImages = useMemo(
    () => allImages.filter((img) => !savedFilenames.has(img.filename)),
    [allImages, savedFilenames],
  );

  function groupByPage(images) {
    const acc = {};
    for (const img of images) {
      const p = img.page_number ?? img.page_num ?? 0;
      if (!acc[p]) acc[p] = [];
      acc[p].push(img);
    }
    return acc;
  }

  const activeImages = subTab === "saved" ? savedImages : addableImages;
  const activeGrouped = groupByPage(activeImages);
  const activeLoading = subTab === "add" && availableLoading;
  const pages = Object.keys(activeGrouped).sort(
    (a, b) => Number(a) - Number(b),
  );

  const handleDownload = async () => {
    setDownloadingId(id);
    await downloadMetadata(project);
    setDownloadingId(null);
  };
  const selectAll = () => {
    const next = {};
    activeImages.forEach((img) => {
      next[img.filename] = true;
    });
    setMarked(next);
  };

  const openLightbox = useCallback((imgs, startIdx) => {
    setLightbox({ images: imgs, startIndex: startIdx });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Sub-tab bar */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border/50 shrink-0 bg-background">
        <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
          {[
            {
              key: "saved",
              icon: Images,
              label: "Saved Pages",
              count: savedImages.length,
              countColor: "text-violet-500 bg-violet-500/10",
            },
            {
              key: "add",
              icon: Plus,
              label: "Add Pages",
              count: allData ? addableImages.length : null,
              countColor: "text-emerald-500 bg-emerald-500/10",
            },
          ].map(({ key, icon: Icon, label, count, countColor }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                                ${
                                  subTab === key
                                    ? "bg-background text-foreground shadow-sm border border-border/40"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count !== null && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${countColor}`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1 text-muted-foreground"
            onClick={selectAll}
          >
            <CheckSquare className="h-3.5 w-3.5" /> Select All
          </Button>
          {hasMarked && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1 text-muted-foreground"
                onClick={() => setMarked({})}
              >
                <Square className="h-3.5 w-3.5" /> Deselect
              </Button>
              <span className="text-xs text-muted-foreground px-1">
                {markedList.length} selected
              </span>
            </>
          )}
          <div className="w-px h-5 bg-border/60 mx-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-violet-500/25 text-violet-500 hover:bg-violet-500/10 ml-1"
            disabled={downloadingId === id}
            onClick={handleDownload}
          >
            {downloadingId === id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download JSON
          </Button>
        </div>
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Upload zone shown in "add" sub-tab */}
        {subTab === "add" && (
          <UploadZone
            projectId={id}
            onUploaded={() => {
              loadAvailablePages(id);
            }}
          />
        )}

        {activeLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading pages…</span>
          </div>
        ) : activeImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              {subTab === "saved" ? (
                <Images className="h-8 w-8 text-muted-foreground/30" />
              ) : (
                <RefreshCw className="h-8 w-8 text-muted-foreground/30" />
              )}
            </div>
            <p className="text-sm font-semibold mb-1">
              {subTab === "saved"
                ? "No pages saved yet"
                : "No project pages to add"}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              {subTab === "saved"
                ? "Once images are saved they'll appear here."
                : "All pages are already added. Upload images from your computer above."}
            </p>
          </div>
        ) : (
          pages.map((page) => (
            <PageGroup
              key={page}
              page={page}
              images={activeGrouped[page]}
              mode={subTab === "saved" ? "remove" : "add"}
              checked={marked}
              onToggle={toggleMark}
              onImageDoubleClick={openLightbox}
            />
          ))
        )}
      </div>

      <div className="shrink-0 px-6 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {subTab === "saved"
            ? `${savedImages.length} page${savedImages.length !== 1 ? "s" : ""} saved`
            : `${addableImages.length} available to add`}
        </p>
        <p className="text-xs text-muted-foreground/40">
          Changes saved to project JSON
        </p>
      </div>
    </div>
  );
}
