
import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

/* ── Single image card ───────────────────────────────────────────────────── */
function ImageCard({ img, isSelected, onSelect }) {
    const imageUrl = `http://localhost:8000${img.url}`
    const [imgError, setImgError] = useState(false)

    return (
        <div
            onClick={onSelect}
            className={`
                relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200
                border-2 select-none
                ${isSelected
                    ? "border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30 scale-[1.01]"
                    : "border-border hover:border-primary/40 hover:shadow-md"
                }
            `}
        >
            {/* Image */}
            <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                {imgError ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">Not found</span>
                    </div>
                ) : (
                    <img
                        src={imageUrl}
                        alt={img.filename}
                        className="object-contain w-full h-full p-1 transition-transform duration-200 group-hover:scale-105"
                        onError={() => setImgError(true)}
                    />
                )}
            </div>

            {/* Checkbox — top right */}
            <div className="absolute top-2 right-2">
                <div className={`
                    h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-150 shadow-sm
                    ${isSelected
                        ? "bg-emerald-500 border-emerald-500"
                        : "bg-background/80 border-border group-hover:border-primary/60"
                    }
                `}>
                    {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Label pill — bottom left */}
            <div className="absolute bottom-2 left-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground rounded-md px-2 py-0.5">
                    {img.label}
                </span>
            </div>

            {/* Footer */}
            <div className={`px-3 py-2 text-[11px] font-medium truncate border-t transition-colors ${isSelected ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/50" : "bg-card text-muted-foreground border-border/50"}`}>
                {img.filename}
            </div>
        </div>
    )
}

/* ── Page group with collapsible expander ────────────────────────────────── */
function PageGroup({ page, images, selected, onSelect }) {
    const [open, setOpen] = useState(true)
    const selectedCount = images.filter(img => selected[img.filename]).length

    return (
        <div className="rounded-xl border border-border/60 overflow-hidden">
            {/* Group header — clickable to expand/collapse */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left gap-3"
            >
                <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm text-foreground">Page {page}</span>
                    <span className="text-xs text-muted-foreground">{images.length} diagram{images.length !== 1 ? "s" : ""}</span>
                </div>
                {selectedCount > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-full px-2.5 py-0.5">
                        {selectedCount} selected
                    </span>
                )}
            </button>

            {/* Image grid */}
            {open && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((img) => (
                        <ImageCard
                            key={img.filename}
                            img={img}
                            isSelected={!!selected[img.filename]}
                            onSelect={() => onSelect(img.filename)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export function ImageGrid({ images, selected, onSelect }) {
    // Group by page_num, sorted ascending
    const grouped = images.reduce((acc, img) => {
        const page = img.page_num || 0
        if (!acc[page]) acc[page] = []
        acc[page].push(img)
        return acc
    }, {})

    const pages = Object.keys(grouped).sort((a, b) => Number(a) - Number(b))

    return (
        <div className="space-y-4">
            {pages.map((page) => (
                <PageGroup
                    key={page}
                    page={page}
                    images={grouped[page]}
                    selected={selected}
                    onSelect={onSelect}
                />
            ))}
        </div>
    )
}
