import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useProjects } from "../../redux/hooks/project/useProjects"
import { BudgetTable } from "../../components/budget/BudgetTable"
import { Button } from "../../components/ui/button"
import {
    ArrowLeft,
    Loader2,
    Trash2,
    Plus,
    Download,
    CheckSquare,
    Square,
    ImageOff,
    ChevronDown,
    ChevronRight,
    Images,
    FolderOpen,
    Save,
    RefreshCw,
    Receipt,
    BarChart3,
    FileJson,
    CalendarDays,
    TrendingUp,
    Package,
    Layers,
    Pencil,
    Check,
    X,
    Database,
    PenLine,
    ZoomIn,
    Upload,
    ChevronLeft,
    ExternalLink,
} from "lucide-react"

const BASE = "http://localhost:8000"

/* ══════════════════════════════════════════════════════════════════════════
   LIGHTBOX — full-screen image viewer, opened on double-click
══════════════════════════════════════════════════════════════════════════ */
function Lightbox({ images, startIndex, onClose }) {
    const [idx, setIdx] = useState(startIndex)
    const img = images[idx]
    const url = `${BASE}${img.url}`
    const hasPrev = idx > 0
    const hasNext = idx < images.length - 1

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose()
            if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1))
            if (e.key === "ArrowRight") setIdx(i => Math.min(images.length - 1, i + 1))
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [images.length, onClose])

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(6px)" }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Close */}
            <button onClick={onClose}
                className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10">
                <X className="h-5 w-5 text-white" />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono bg-white/10 rounded-full px-3 py-1">
                {idx + 1} / {images.length}
            </div>

            {/* Prev */}
            {hasPrev && (
                <button onClick={() => setIdx(i => i - 1)}
                    className="absolute left-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
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
                    <a href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        Open original
                    </a>
                </div>
            </div>

            {/* Next */}
            {hasNext && (
                <button onClick={() => setIdx(i => i + 1)}
                    className="absolute right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ChevronRight className="h-5 w-5 text-white" />
                </button>
            )}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   THUMB CARD — single image tile
   • single-click  → toggle select
   • double-click  → open lightbox (does NOT affect selection)
══════════════════════════════════════════════════════════════════════════ */
function ThumbCard({ img, mode, checked, onToggle, onDoubleClick }) {
    const [err, setErr] = useState(false)
    const clickTimerRef = useRef(null)
    const url = `${BASE}${img.url}`

    // Disambiguate single vs double click so double-click never toggles selection
    const handleClick = (e) => {
        e.stopPropagation()
        if (clickTimerRef.current) {
            // Second click arrived quickly → it's a double-click, cancel the pending single-click
            clearTimeout(clickTimerRef.current)
            clickTimerRef.current = null
            onDoubleClick?.()
        } else {
            clickTimerRef.current = setTimeout(() => {
                clickTimerRef.current = null
                onToggle()
            }, 220)
        }
    }

    return (
        <div
            onClick={handleClick}
            title={`${img.filename}\n(double-click to view full size)`}
            className={`relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 border-2 select-none flex flex-col
                ${checked
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
                    <img src={url} alt={img.filename}
                        className="object-contain w-full h-full p-1 transition-transform duration-200 group-hover:scale-105"
                        onError={() => setErr(true)}
                    />
                )}

                {/* Double-click hint — inside image so it doesn't push layout */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                        <ZoomIn className="h-3 w-3 text-white/70" />
                        <span className="text-[10px] text-white/70 font-medium">double-click</span>
                    </div>
                </div>

                {/* Select indicator */}
                <div className="absolute top-2 right-2">
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shadow-sm transition-all duration-150
                        ${checked
                            ? mode === "remove" ? "bg-red-500 border-red-500" : "bg-emerald-500 border-emerald-500"
                            : "bg-background/80 border-border group-hover:border-violet-400/60"
                        }`}>
                        {checked && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Footer: filename + label — always visible below image ── */}
            <div className={`px-2.5 py-2 border-t flex items-center gap-1.5 min-w-0 transition-colors
                ${checked
                    ? mode === "remove"
                        ? "bg-red-50 dark:bg-red-950/30 border-red-200/50"
                        : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50"
                    : "bg-card border-border/50"
                }`}
            >
                {/* Filename — monospace, truncates with full name in tooltip */}
                <span
                    className={`flex-1 min-w-0 text-[11px] font-semibold font-mono truncate leading-none
                        ${checked
                            ? mode === "remove" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                            : "text-foreground/80"
                        }`}
                    title={img.filename}
                >
                    {img.filename}
                </span>

                {/* Label badge */}
                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 leading-none border
                    ${img.label && img.label !== "full"
                        ? "bg-violet-500/10 text-violet-500 border-violet-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                    }`}>
                    {img.label || "full"}
                </span>
            </div>
        </div>
    )
}

/* ── Collapsible page group ─────────────────────────────────────────────── */
function PageGroup({ page, images, mode, checked, onToggle, onImageDoubleClick }) {
    const [open, setOpen] = useState(true)
    const checkedCount = images.filter(img => checked[img.filename]).length
    return (
        <div className="rounded-xl border border-border/60 overflow-hidden">
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left gap-3">
                <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm">Page {page}</span>
                    <span className="text-xs text-muted-foreground">{images.length} image{images.length !== 1 ? "s" : ""}</span>
                </div>
                {checkedCount > 0 && (
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border
                        ${mode === "remove"
                            ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50"
                            : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50"
                        }`}>
                        {checkedCount} marked
                    </span>
                )}
            </button>
            {open && (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {images.map((img, i) => (
                        <ThumbCard key={img.filename} img={img} mode={mode}
                            checked={!!checked[img.filename]}
                            onToggle={() => onToggle(img.filename)}
                            onDoubleClick={() => onImageDoubleClick(images, i)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ── Upload drop zone for external images ───────────────────────────────── */
function UploadZone({ projectId, onUploaded }) {
    const [dragging, setDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileRef = useRef(null)
    const [error, setError] = useState("")

    const doUpload = async (files) => {
        if (!files?.length) return
        setUploading(true)
        setError("")
        let uploaded = 0
        for (const file of files) {
            if (!file.type.startsWith("image/")) continue
            const fd = new FormData()
            fd.append("file", file)
            fd.append("page_number", 1)   // default; user configures in the Add-to-Project modal
            fd.append("label", "a")
            try {
                const res = await fetch(`${BASE}/projects/${projectId}/upload-image`, { method: "POST", body: fd })
                if (!res.ok) throw new Error(await res.text())
                uploaded++
            } catch (e) {
                setError(e.message)
            }
        }
        setUploading(false)
        if (uploaded > 0) onUploaded()
    }

    const onDrop = (e) => {
        e.preventDefault(); setDragging(false)
        doUpload(Array.from(e.dataTransfer.files))
    }

    return (
        <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Upload className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                    <p className="text-sm font-semibold">Upload from your computer</p>
                    <p className="text-xs text-muted-foreground">Drag &amp; drop or click to browse — then select &amp; click <strong>Add to Project</strong> to configure &amp; save</p>
                </div>
                <Button size="sm" variant="outline"
                    className="ml-auto h-8 text-xs gap-1.5 border-violet-500/25 text-violet-500 hover:bg-violet-500/10"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Browse Files
                </Button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => doUpload(Array.from(e.target.files))} />
            </div>

            <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center py-10 gap-2 transition-colors cursor-pointer
                    ${dragging ? "bg-violet-500/10" : "hover:bg-muted/40"}`}
                onClick={() => fileRef.current?.click()}
            >
                {uploading ? (
                    <><Loader2 className="h-8 w-8 animate-spin text-violet-400" /><p className="text-sm text-muted-foreground">Uploading…</p></>
                ) : (
                    <>
                        <div className={`h-12 w-12 rounded-2xl border-2 flex items-center justify-center transition-colors ${dragging ? "border-violet-400 bg-violet-500/15" : "border-dashed border-border"}`}>
                            <Upload className={`h-6 w-6 transition-colors ${dragging ? "text-violet-400" : "text-muted-foreground/40"}`} />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">
                            {dragging ? "Drop images here" : "Drop image files here"}
                        </p>
                        <p className="text-xs text-muted-foreground/50">Supports PNG, JPG, JPEG, WEBP, GIF</p>
                    </>
                )}
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
        </div>
    )
}

/* ── Configuration modal for adding pages ────────────────────────────── */
function AddPagesConfigModal({ filenames, allImages, onConfirm, onCancel, loading }) {
    const [configs, setConfigs] = useState(() => {
        const initial = {}
        filenames.forEach(fn => {
            const img = allImages.find(i => i.filename === fn)
            initial[fn] = {
                page_number: img?.page_num ?? img?.page_number ?? 1,
                label: "a"   // default label is always "a"
            }
        })
        return initial
    })

    const updateConfig = (fn, key, val) => {
        setConfigs(prev => ({ ...prev, [fn]: { ...prev[fn], [key]: val } }))
    }

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-background border border-border rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
                    <div>
                        <h3 className="text-lg font-bold">Configure Registry Metadata</h3>
                        <p className="text-xs text-muted-foreground">Set page numbers and labels for {filenames.length} images</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {filenames.map(fn => (
                        <div key={fn} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/40">
                            <div className="h-16 w-20 shrink-0 bg-muted rounded-lg overflow-hidden border border-border/40">
                                <img src={`${BASE}${allImages.find(i => i.filename === fn)?.url}`} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-mono font-bold truncate mb-3 text-muted-foreground">{fn}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Page Number</label>
                                        <input type="number" value={configs[fn].page_number} onChange={e => updateConfig(fn, "page_number", Number(e.target.value))}
                                            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:border-violet-400" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Label</label>
                                        <input type="text" value={configs[fn].label} onChange={e => updateConfig(fn, "label", e.target.value)}
                                            placeholder="e.g. a, b, floor1"
                                            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:border-violet-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        onClick={() => onConfirm(configs)} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Finalize & Add to Project
                    </Button>
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   SOURCE TAB  (formerly "Editor")
   – Saved Pages / Add Pages sub-tabs
   – Double-click opens full-screen Lightbox
   – Upload from computer in Add Pages
══════════════════════════════════════════════════════════════════════════ */
function SourceTab({ project }) {
    const { availablePages, availableLoading, loadOne,
        loadAvailablePages, clearPages, downloadMetadata, updatePages, pagesUpdating } = useProjects()

    const [subTab, setSubTab] = useState("saved")
    const [marked, setMarked] = useState({})
    const [downloadingId, setDownloadingId] = useState(null)
    const [lightbox, setLightbox] = useState(null)
    const [configuringAdd, setConfiguringAdd] = useState(null)

    const id = project._id ?? project.id

    // ── Saved images come directly from MongoDB project document ──────────
    const savedImages = project.selected_diagram_metadata?.images ?? []

    // ── Available images still fetched from backend (all in sectioned/) ───
    const allData = availablePages[id]
    useEffect(() => { if (subTab === "add" && !allData) loadAvailablePages(id) }, [subTab, id, allData, loadAvailablePages])
    useEffect(() => { return () => clearPages(id) }, [id, clearPages])
    useEffect(() => { setMarked({}) }, [subTab])

    const toggleMark = useCallback((fn) => setMarked(prev => ({ ...prev, [fn]: !prev[fn] })), [])
    const markedList = Object.entries(marked).filter(([, v]) => v).map(([k]) => k)
    const hasMarked = markedList.length > 0
    const allImages = allData?.images ?? []
    const savedFilenames = useMemo(() => new Set(savedImages.map(i => i.filename)), [savedImages])
    // Also exclude images that have already been added (tracked by source_filename on the saved entry)
    const savedSourceFilenames = useMemo(() => new Set(
        savedImages.map(i => i.source_filename).filter(Boolean)
    ), [savedImages])
    const addableImages = useMemo(() =>
        allImages.filter(img => !savedFilenames.has(img.filename) && !savedSourceFilenames.has(img.filename)),
        [allImages, savedFilenames, savedSourceFilenames]
    )

    function groupByPage(images) {
        const acc = {}
        for (const img of images) {
            const p = img.page_number ?? img.page_num ?? 0
            if (!acc[p]) acc[p] = []
            acc[p].push(img)
        }
        return acc
    }

    const activeImages = subTab === "saved" ? savedImages : addableImages
    const activeGrouped = groupByPage(activeImages)
    const activeLoading = subTab === "add" && availableLoading
    const pages = Object.keys(activeGrouped).sort((a, b) => Number(a) - Number(b))

    const handleDownload = async () => { setDownloadingId(id); await downloadMetadata(project); setDownloadingId(null) }
    const selectAll = () => { const next = {}; activeImages.forEach(img => { next[img.filename] = true }); setMarked(next) }

    const openLightbox = useCallback((imgs, startIdx) => {
        setLightbox({ images: imgs, startIndex: startIdx })
    }, [])

    return (
        <div className="flex flex-col h-full">
            {/* Lightbox */}
            {lightbox && (
                <Lightbox images={lightbox.images} startIndex={lightbox.startIndex}
                    onClose={() => setLightbox(null)} />
            )}

            {/* Config Modal */}
            {configuringAdd && (
                <AddPagesConfigModal
                    filenames={configuringAdd}
                    allImages={allImages}
                    loading={pagesUpdating}
                    onCancel={() => setConfiguringAdd(null)}
                    onConfirm={async (metadata) => {
                        const result = await updatePages({ id, add_filenames: configuringAdd, add_metadata: metadata })
                        // Redux slice optimistically removes added images from availablePages
                        // and updates currentProject.selected_diagram_metadata instantly
                        setMarked({})
                        setConfiguringAdd(null)
                    }}
                />
            )}

            {/* Sub-tab bar */}
            <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border/50 shrink-0 bg-background">
                <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
                    {[
                        { key: "saved", icon: Images, label: "Saved Pages", count: savedImages.length, countColor: "text-violet-500 bg-violet-500/10" },
                        { key: "add", icon: Plus, label: "Add Pages", count: allData ? addableImages.length : null, countColor: "text-emerald-500 bg-emerald-500/10" },
                    ].map(({ key, icon: Icon, label, count, countColor }) => (
                        <button key={key} onClick={() => setSubTab(key)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                                ${subTab === key
                                    ? "bg-background text-foreground shadow-sm border border-border/40"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}>
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                            {count !== null && (
                                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${countColor}`}>{count}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-muted-foreground" onClick={selectAll}>
                        <CheckSquare className="h-3.5 w-3.5" /> Select All
                    </Button>
                    {hasMarked && (
                        <>
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-muted-foreground" onClick={() => setMarked({})}>
                                <Square className="h-3.5 w-3.5" /> Deselect
                            </Button>
                            <span className="text-xs text-muted-foreground px-1">{markedList.length} selected</span>
                        </>
                    )}
                    <div className="w-px h-5 bg-border/60 mx-1" />

                    {hasMarked && (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4">
                            {subTab === "saved" ? (
                                <Button size="sm" variant="destructive"
                                    className="h-8 text-xs gap-1.5 shadow-sm shadow-red-500/20"
                                    disabled={pagesUpdating}
                                    onClick={async () => {
                                        await updatePages({ id, remove_filenames: markedList })
                                        setMarked({})
                                        // Redux slice optimistically updates availablePages + currentProject
                                        // No need to refetch from backend
                                    }}>
                                    {pagesUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    Remove from Saved
                                </Button>
                            ) : (
                                <Button size="sm"
                                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20"
                                    disabled={pagesUpdating}
                                    onClick={() => setConfiguringAdd(markedList)}>
                                    {pagesUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                    Add to Project
                                </Button>
                            )}
                        </div>
                    )}

                    <Button size="sm" variant="outline"
                        className="h-8 text-xs gap-1.5 border-violet-500/25 text-violet-500 hover:bg-violet-500/10 ml-1"
                        disabled={downloadingId === id} onClick={handleDownload}>
                        {downloadingId === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
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
                        onUploaded={() => { loadAvailablePages(id) }}
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
                            {subTab === "saved" ? <Images className="h-8 w-8 text-muted-foreground/30" /> : <RefreshCw className="h-8 w-8 text-muted-foreground/30" />}
                        </div>
                        <p className="text-sm font-semibold mb-1">{subTab === "saved" ? "No pages saved yet" : "No project pages to add"}</p>
                        <p className="text-xs text-muted-foreground max-w-xs mt-1">
                            {subTab === "saved"
                                ? "Once images are saved they'll appear here."
                                : "All pages are already added. Upload images from your computer above."}
                        </p>
                    </div>
                ) : (
                    pages.map(page => (
                        <PageGroup key={page} page={page} images={activeGrouped[page]}
                            mode={subTab === "saved" ? "remove" : "add"} checked={marked}
                            onToggle={toggleMark}
                            onImageDoubleClick={openLightbox}
                        />
                    ))
                )}
            </div>

            <div className="shrink-0 px-6 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    {subTab === "saved" ? `${savedImages.length} page${savedImages.length !== 1 ? "s" : ""} saved` : `${addableImages.length} available to add`}
                </p>
                <p className="text-xs text-muted-foreground/40">Changes saved to project JSON</p>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   EDITOR TAB  (empty canvas — coming soon)
══════════════════════════════════════════════════════════════════════════ */
function EditorTab() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8">
            <div className="relative">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/20 flex items-center justify-center shadow-xl shadow-violet-500/10">
                    <PenLine className="h-9 w-9 text-violet-400/70" />
                </div>
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center">
                    <span className="text-[9px] font-bold text-amber-900">!</span>
                </div>
            </div>
            <div>
                <h2 className="text-lg font-bold mb-1.5">Visual Editor</h2>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    The annotation and markup canvas is coming soon. Here you'll be able to
                    draw, annotate, and mark up floor plan images directly.
                </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
                {["Annotations", "Markup", "Measurements", "Export"].map(tag => (
                    <span key={tag} className="text-xs bg-muted text-muted-foreground rounded-full px-3 py-1 border border-border/60 font-medium">
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    )
}

/* ── Summary Tab ────────────────────────────────────────────────────────── */
function SummaryTab({ project }) {
    const { projectPages, pagesLoading, loadProjectPages } = useProjects()
    const id = project._id ?? project.id   // MongoDB _id
    const savedData = projectPages[id]
    const savedImages = savedData?.images ?? []
    useEffect(() => { loadProjectPages(id) }, [id, loadProjectPages])

    const byPage = useMemo(() => {
        const acc = {}
        for (const img of savedImages) {
            const p = img.page_number ?? img.page_num ?? "Unknown"
            if (!acc[p]) acc[p] = []
            acc[p].push(img)
        }
        return acc
    }, [savedImages])

    const pageEntries = Object.entries(byPage).sort(([a], [b]) => Number(a) - Number(b))
    const formatDate = (iso) => {
        if (!iso) return "—"
        return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-3xl space-y-5">
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Total Images", value: savedImages.length, icon: Images, from: "from-violet-500/10", iconCls: "text-violet-400" },
                        { label: "Pages Used", value: pageEntries.length, icon: Layers, from: "from-indigo-500/10", iconCls: "text-indigo-400" },
                        { label: "Created", value: formatDate(project.created_at), icon: CalendarDays, from: "from-emerald-500/10", iconCls: "text-emerald-400", small: true },
                    ].map(({ label, value, icon: Icon, from, iconCls, small }) => (
                        <div key={label} className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
                            <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${from} to-transparent flex items-center justify-center`}>
                                <Icon className={`h-5 w-5 ${iconCls}`} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                                <p className={`font-bold leading-tight mt-0.5 ${small ? "text-base" : "text-2xl"}`}>{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
                {project.pdf_name && (
                    <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
                        <div className="h-11 w-11 shrink-0 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <FileJson className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Source PDF</p>
                            <p className="text-sm font-semibold mt-0.5">{project.pdf_name}</p>
                        </div>
                    </div>
                )}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-2.5">
                        <TrendingUp className="h-4 w-4 text-violet-400" />
                        <span className="font-semibold text-sm">Pages Breakdown</span>
                        <span className="ml-auto text-xs text-muted-foreground">{pageEntries.length} pages</span>
                    </div>
                    {pagesLoading ? (
                        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading…</span>
                        </div>
                    ) : pageEntries.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-center px-4">
                            <Package className="h-9 w-9 text-muted-foreground/25 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">No pages saved yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Switch to Source tab to add pages.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {pageEntries.map(([page, imgs], idx) => (
                                <div key={page} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                                    <span className="text-xs text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                                    <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/15 flex items-center justify-center">
                                        <span className="text-xs font-bold text-violet-400">{page}</span>
                                    </div>
                                    <span className="text-sm font-medium flex-1">Page {page}</span>
                                    <span className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-1 font-semibold">
                                        {imgs.length} image{imgs.length !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ── Inline project name editor ─────────────────────────────────────────── */
function ProjectNameEditor({ project, onRename }) {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(project?.name ?? "")
    const [saving, setSaving] = useState(false)
    const inputRef = useRef(null)

    useEffect(() => { setValue(project?.name ?? "") }, [project?.name])

    const startEdit = () => { setEditing(true); setTimeout(() => inputRef.current?.select(), 50) }
    const cancel = () => { setEditing(false); setValue(project?.name ?? "") }
    const save = async () => {
        const trimmed = value.trim()
        if (!trimmed || trimmed === project?.name) { cancel(); return }
        setSaving(true)
        await onRename(project._id ?? project.id, trimmed)
        setSaving(false)
        setEditing(false)
    }
    const onKey = (e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel() }

    if (!editing) {
        return (
            <div className="flex items-start gap-2 group/name min-w-0">
                <p className="text-sidebar-foreground text-xs font-semibold leading-snug truncate flex-1" title={project?.name}>
                    {project?.name ?? "Loading…"}
                </p>
                {project && (
                    <button onClick={startEdit} title="Rename project"
                        className="shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity h-5 w-5 rounded-md hover:bg-white/10 flex items-center justify-center mt-0.5">
                        <Pencil className="h-3 w-3 text-sidebar-foreground/50" />
                    </button>
                )}
            </div>
        )
    }
    return (
        <div className="flex items-center gap-1.5 w-full">
            <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
                onKeyDown={onKey} disabled={saving}
                className="flex-1 min-w-0 text-xs font-semibold bg-white/10 border border-violet-400/40 rounded-md px-2 py-1 text-sidebar-foreground placeholder:text-white/30 focus:outline-none focus:border-violet-400/80"
                placeholder="Project name" autoFocus />
            <button onClick={save} disabled={saving}
                className="h-6 w-6 shrink-0 rounded-md bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 flex items-center justify-center transition-colors">
                {saving ? <Loader2 className="h-3 w-3 text-violet-300 animate-spin" /> : <Check className="h-3 w-3 text-violet-300" />}
            </button>
            <button onClick={cancel}
                className="h-6 w-6 shrink-0 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
                <X className="h-3 w-3 text-sidebar-foreground/50" />
            </button>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export function ProjectEditorPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const {
        currentProject,
        currentProjectLoading,
        error,
        loadOne,
        rename,
        clearCurrentProj,
    } = useProjects()
    const [activeTab, setActiveTab] = useState("source")

    // Fetch this specific project from backend on mount (or when id changes)
    // This ensures it works even on direct navigation / page refresh
    useEffect(() => {
        loadOne(id)
        return () => clearCurrentProj()   // clean up on unmount
    }, [id])   // eslint-disable-line react-hooks/exhaustive-deps

    const project = currentProject

    const TABS = [
        { key: "editor", label: "Editor", icon: PenLine, desc: "Visual canvas editor" },
        { key: "source", label: "Source", icon: Database, desc: "Manage source images" },
        { key: "budget", label: "Budget", icon: Receipt, desc: "View & edit budget" },
        { key: "summary", label: "Summary", icon: BarChart3, desc: "Project overview" },
    ]

    // Loading state
    if (currentProjectLoading && !project) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium">Loading project…</span>
            </div>
        )
    }

    // Error / not found state
    if (!currentProjectLoading && !project && error) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-4 text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <X className="h-8 w-8 text-destructive" />
                </div>
                <div>
                    <p className="font-semibold mb-1">Project not found</p>
                    <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back to Projects
                </Button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 flex bg-background overflow-hidden">

            {/* ── Project sidebar ── */}
            <aside className="w-60 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
                <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
                    <button onClick={() => navigate("/projects")}
                        className="flex items-center gap-1.5 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 text-xs mb-4 transition-colors group">
                        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        All Projects
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/25 to-indigo-600/25 border border-violet-500/25 flex items-center justify-center shadow-sm">
                            <FolderOpen className="h-4 w-4 text-violet-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <ProjectNameEditor project={project} onRename={rename} />
                            {project?.pdf_name && (
                                <p className="text-sidebar-foreground/30 text-[10px] truncate mt-1" title={project.pdf_name}>
                                    {project.pdf_name}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/25 px-2 pt-1 pb-2">
                        Project Tools
                    </p>
                    {TABS.map(({ key, label, icon: Icon, desc }) => {
                        const isActive = activeTab === key
                        return (
                            <button key={key} onClick={() => setActiveTab(key)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 relative group
                                    ${isActive
                                        ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                                        : "text-sidebar-foreground/45 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/80"
                                    }`}>
                                {isActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-violet-400 to-indigo-500" />
                                )}
                                <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-all duration-200
                                    ${isActive
                                        ? "bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20"
                                        : "bg-sidebar-foreground/[0.04] border border-sidebar-foreground/[0.07] group-hover:bg-sidebar-foreground/[0.08]"
                                    }`}>
                                    <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-violet-400" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60"}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold leading-none">{label}</p>
                                    <p className="text-[10px] text-sidebar-foreground/25 mt-1 leading-none">{desc}</p>
                                </div>
                            </button>
                        )
                    })}
                </nav>

                {project && (
                    <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
                        {/* Image count */}
                        <div className="rounded-xl bg-sidebar-accent border border-sidebar-border px-3 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Images className="h-3.5 w-3.5 text-violet-400/70" />
                                <span className="text-[11px] text-sidebar-foreground/40 font-medium">Images</span>
                            </div>
                            <span className="text-sm font-bold text-sidebar-foreground/75">{project.image_count}</span>
                        </div>
                        {/* DPI badge if available */}
                        {project.detail?.dpi && (
                            <div className="rounded-xl bg-sidebar-accent border border-sidebar-border px-3 py-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className="h-3.5 w-3.5 text-indigo-400/70" />
                                    <span className="text-[11px] text-sidebar-foreground/40 font-medium">DPI</span>
                                </div>
                                <span className="text-sm font-bold text-sidebar-foreground/75">{project.detail.dpi}</span>
                            </div>
                        )}
                    </div>
                )}
            </aside>

            {/* ── Main content ── */}
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="h-14 shrink-0 border-b border-border/50 px-6 flex items-center gap-3 bg-background">
                    {TABS.map(({ key, label, icon: Icon }) =>
                        activeTab === key ? (
                            <div key={key} className="flex items-center gap-2.5">
                                <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                    <Icon className="h-4 w-4 text-violet-400" />
                                </div>
                                <span className="font-semibold text-sm">{label}</span>
                                {project && <span className="text-xs text-muted-foreground/50 font-normal">— {project.name}</span>}
                            </div>
                        ) : null
                    )}
                    {/* Refresh button */}
                    <button
                        onClick={() => loadOne(id)}
                        disabled={currentProjectLoading}
                        className="ml-auto h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30"
                        title="Refresh project data from server"
                    >
                        {currentProjectLoading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />
                        }
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {!project ? (
                        <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Loading project…</span>
                        </div>
                    ) : activeTab === "editor" ? (
                        <EditorTab />
                    ) : activeTab === "source" ? (
                        <SourceTab project={project} />
                    ) : activeTab === "budget" ? (
                        <div className="flex-1 overflow-y-auto p-6">
                            <BudgetTable />
                        </div>
                    ) : (
                        <SummaryTab project={project} />
                    )}
                </div>
            </div>
        </div>
    )
}
