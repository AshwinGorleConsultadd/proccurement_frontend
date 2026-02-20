import { useEffect, useState, useMemo } from "react"
import { useProjects } from "../../redux/hooks/project/useProjects"
import { Button } from "../ui/button"
import {
    X,
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
} from "lucide-react"

const BASE = "http://localhost:8000"

/* ── Tiny image thumbnail card ─────────────────────────────────────────── */
function ThumbCard({ img, mode, checked, onToggle }) {
    const [err, setErr] = useState(false)
    const url = `${BASE}${img.url}`

    return (
        <div
            onClick={onToggle}
            title={img.filename}
            className={`
                relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200
                border-2 select-none
                ${checked
                    ? mode === "remove"
                        ? "border-red-500 shadow-lg shadow-red-500/20 ring-2 ring-red-500/30"
                        : "border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30"
                    : "border-border hover:border-violet-400/60 hover:shadow-md"
                }
            `}
        >
            {/* Image */}
            <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
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
            </div>

            {/* Checkbox overlay */}
            <div className="absolute top-2 right-2">
                <div className={`
                    h-6 w-6 rounded-full border-2 flex items-center justify-center shadow-sm transition-all duration-150
                    ${checked
                        ? mode === "remove"
                            ? "bg-red-500 border-red-500"
                            : "bg-emerald-500 border-emerald-500"
                        : "bg-background/80 border-border group-hover:border-violet-400/60"
                    }
                `}>
                    {checked && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Label pill */}
            <div className="absolute bottom-2 left-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground rounded-md px-1.5 py-0.5">
                    {img.label || img.filename}
                </span>
            </div>

            {/* Footer */}
            <div className={`px-2.5 py-1.5 text-[10px] font-medium truncate border-t transition-colors
                ${checked
                    ? mode === "remove"
                        ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200/50"
                        : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/50"
                    : "bg-card text-muted-foreground border-border/50"
                }`}
            >
                {img.filename}
            </div>
        </div>
    )
}

/* ── Collapsible page group ─────────────────────────────────────────────── */
function PageGroup({ page, images, mode, checked, onToggle }) {
    const [open, setOpen] = useState(true)
    const checkedCount = images.filter(img => checked[img.filename]).length

    return (
        <div className="rounded-xl border border-border/60 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left gap-3"
            >
                <div className="flex items-center gap-3">
                    {open
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                    <span className="font-semibold text-sm">Page {page}</span>
                    <span className="text-xs text-muted-foreground">{images.length} image{images.length !== 1 ? "s" : ""}</span>
                </div>
                {checkedCount > 0 && (
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border
                        ${mode === "remove"
                            ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50"
                            : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50"
                        }`
                    }>
                        {checkedCount} marked
                    </span>
                )}
            </button>
            {open && (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {images.map(img => (
                        <ThumbCard
                            key={img.filename}
                            img={img}
                            mode={mode}
                            checked={!!checked[img.filename]}
                            onToggle={() => onToggle(img.filename)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ── Main modal ─────────────────────────────────────────────────────────── */
export function ProjectDetailModal({ project, onClose }) {
    const {
        projectPages,
        availablePages,
        pagesLoading,
        availableLoading,
        pagesUpdating,
        loadProjectPages,
        loadAvailablePages,
        updatePages,
        clearPages,
        downloadMetadata,
    } = useProjects()

    // "remove" = viewing saved pages and marking to remove
    // "add"    = viewing all available pages and marking to add
    const [tab, setTab] = useState("saved") // "saved" | "add"
    const [marked, setMarked] = useState({}) // { filename: true }
    const [downloadingId, setDownloadingId] = useState(null)
    const [saveSuccess, setSaveSuccess] = useState(false)

    const id = project.id
    const savedData = projectPages[id]
    const allData = availablePages[id]

    // Load on mount
    useEffect(() => {
        loadProjectPages(id)
    }, [id, loadProjectPages])

    // Load available pages when switching to "add" tab
    useEffect(() => {
        if (tab === "add" && !allData) {
            loadAvailablePages(id)
        }
    }, [tab, id, allData, loadAvailablePages])

    // Clear on unmount
    useEffect(() => {
        return () => clearPages(id)
    }, [id, clearPages])

    // Reset marks when switching tabs
    useEffect(() => {
        setMarked({})
    }, [tab])

    const toggleMark = (filename) =>
        setMarked(prev => ({ ...prev, [filename]: !prev[filename] }))

    const markedList = Object.entries(marked).filter(([, v]) => v).map(([k]) => k)
    const hasMarked = markedList.length > 0

    /* ── Compute what to display ─────────────────────────────────────────── */
    const savedImages = savedData?.images ?? []
    const allImages = allData?.images ?? []

    // For "add" tab: only show images NOT already saved, to avoid confusion
    const savedFilenames = useMemo(() => new Set(savedImages.map(i => i.filename)), [savedImages])
    const addableImages = useMemo(
        () => allImages.filter(img => !savedFilenames.has(img.filename)),
        [allImages, savedFilenames]
    )

    // Group by page number
    function groupByPage(images) {
        const acc = {}
        for (const img of images) {
            const p = img.page_number ?? img.page_num ?? 0
            if (!acc[p]) acc[p] = []
            acc[p].push(img)
        }
        return acc
    }

    const savedGrouped = groupByPage(savedImages)
    const addGrouped = groupByPage(addableImages)
    const activeGrouped = tab === "saved" ? savedGrouped : addGrouped
    const activeImages = tab === "saved" ? savedImages : addableImages
    const activeLoading = tab === "saved" ? pagesLoading : availableLoading
    const pages = Object.keys(activeGrouped).sort((a, b) => Number(a) - Number(b))

    /* ── Actions ──────────────────────────────────────────────────────────── */
    const handleSave = async () => {
        if (!hasMarked) return
        const payload =
            tab === "saved"
                ? { id, remove_filenames: markedList }
                : { id, add_filenames: markedList }

        const result = await updatePages(payload)
        if (!result?.error) {
            setSaveSuccess(true)
            setMarked({})
            setTimeout(() => setSaveSuccess(false), 2000)
            // Refresh saved list
            loadProjectPages(id)
        }
    }

    const handleDownload = async () => {
        setDownloadingId(id)
        await downloadMetadata(project)
        setDownloadingId(null)
    }

    const selectAll = () => {
        const next = {}
        activeImages.forEach(img => { next[img.filename] = true })
        setMarked(next)
    }

    const deselectAll = () => setMarked({})

    /* ── Render ───────────────────────────────────────────────────────────── */
    return (
        // Backdrop
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            {/* Modal panel */}
            <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
                            <FolderOpen className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-tight">{project.name}</h2>
                            {project.pdf_name && (
                                <p className="text-xs text-muted-foreground">{project.pdf_name}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs border-violet-500/20 text-violet-500 hover:bg-violet-500/10"
                            disabled={!project.metadata_path || downloadingId === id}
                            onClick={handleDownload}
                        >
                            {downloadingId === id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />
                            }
                            Download JSON
                        </Button>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-6 pt-4 shrink-0">
                    <button
                        onClick={() => setTab("saved")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${tab === "saved"
                                ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                    >
                        <Images className="h-4 w-4" />
                        Saved Pages
                        <span className="ml-1 text-xs rounded-full bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
                            {savedImages.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setTab("add")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${tab === "add"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                    >
                        <Plus className="h-4 w-4" />
                        Add Pages
                        {allData && (
                            <span className="ml-1 text-xs rounded-full bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
                                {addableImages.length} available
                            </span>
                        )}
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-muted/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={selectAll}>
                            <CheckSquare className="h-3.5 w-3.5" />
                            Select All
                        </Button>
                        {hasMarked && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={deselectAll}>
                                <Square className="h-3.5 w-3.5" />
                                Deselect All
                            </Button>
                        )}
                        {hasMarked && (
                            <span className="text-xs text-muted-foreground">
                                {markedList.length} selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {tab === "saved" ? (
                            <Button
                                size="sm"
                                disabled={!hasMarked || pagesUpdating}
                                onClick={handleSave}
                                className="h-7 text-xs gap-1.5 bg-red-500 hover:bg-red-600 text-white border-0 shadow-sm"
                            >
                                {pagesUpdating
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />
                                }
                                Remove Selected
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                disabled={!hasMarked || pagesUpdating}
                                onClick={handleSave}
                                className="h-7 text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-sm"
                            >
                                {pagesUpdating
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Save className="h-3.5 w-3.5" />
                                }
                                Add Selected
                            </Button>
                        )}
                        {saveSuccess && (
                            <span className="text-xs text-emerald-500 font-medium animate-pulse">✓ Saved!</span>
                        )}
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {activeLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Loading pages…</span>
                        </div>
                    ) : activeImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-16 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                {tab === "saved"
                                    ? <Images className="h-7 w-7 text-muted-foreground/40" />
                                    : <RefreshCw className="h-7 w-7 text-muted-foreground/40" />
                                }
                            </div>
                            <p className="text-sm font-medium mb-1">
                                {tab === "saved" ? "No pages saved yet" : "No additional pages available"}
                            </p>
                            <p className="text-xs text-muted-foreground max-w-xs">
                                {tab === "saved"
                                    ? "Once images are saved with this project, they'll appear here."
                                    : "All available pages from this job are already in the project, or the job data isn't available."
                                }
                            </p>
                        </div>
                    ) : (
                        pages.map(page => (
                            <PageGroup
                                key={page}
                                page={page}
                                images={activeGrouped[page]}
                                mode={tab === "saved" ? "remove" : "add"}
                                checked={marked}
                                onToggle={toggleMark}
                            />
                        ))
                    )}
                </div>

                {/* Footer info bar */}
                <div className="shrink-0 px-6 py-3 border-t border-border/50 bg-muted/10 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        {tab === "saved"
                            ? `${savedImages.length} page${savedImages.length !== 1 ? "s" : ""} saved in this project`
                            : `${addableImages.length} page${addableImages.length !== 1 ? "s" : ""} available to add`
                        }
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                        Changes are saved directly to the project JSON
                    </p>
                </div>
            </div>
        </div>
    )
}
