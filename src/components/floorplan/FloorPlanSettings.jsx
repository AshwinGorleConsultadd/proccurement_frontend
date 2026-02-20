
import { useState, useRef } from "react"
import { Button } from "../ui/button"
import {
    Loader2, Upload, FileText, Zap, CheckCircle2, X, FolderOpen
} from "lucide-react"

export function FloorPlanSettings({ onProcess, loading, pdfs, onUpload }) {
    const [file, setFile] = useState(null)
    const [documentName, setDocumentName] = useState("")
    const [uploadedPdfId, setUploadedPdfId] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const fileInputRef = useRef(null)

    const pickFile = (selected) => {
        if (!selected || !selected.name.toLowerCase().endsWith(".pdf")) return
        setFile(selected)
        setDocumentName(selected.name.replace(/\.pdf$/i, ""))
        setUploadedPdfId(null)
    }

    const handleFileChange = (e) => pickFile(e.target.files?.[0])
    const handleDrop = (e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }
    const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
    const handleDragLeave = () => setDragging(false)

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)
        try {
            const renamedFile = new File(
                [file],
                `${(documentName || file.name.replace(/\.pdf$/i, "")).trim()}.pdf`,
                { type: file.type }
            )
            const result = await onUpload(renamedFile)
            if (result?.payload?.id) setUploadedPdfId(result.payload.id)
        } finally {
            setUploading(false)
        }
    }

    const handleClearFile = () => {
        setFile(null)
        setDocumentName("")
        setUploadedPdfId(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleProcess = () => {
        const pdfId = uploadedPdfId || (pdfs.length > 0 ? pdfs[pdfs.length - 1]?.id : null)
        if (pdfId) onProcess(pdfId, 300)
    }

    const isReady = !!(uploadedPdfId || pdfs.length > 0)
    const canUpload = file && !uploadedPdfId && documentName.trim()

    /* ── render ─────────────────────────────────────────────────────────────── */
    return (
        <div className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden flex flex-col">

            {/* ── Header ── */}
            <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0">
                    <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                    <p className="font-semibold text-sm text-foreground">Floor Plan Processor</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Extracts diagrams at 300 DPI</p>
                </div>
            </div>

            <div className="p-5 flex flex-col gap-4">

                {/* ── STATE 1 : no file ── */}
                {!file && !uploadedPdfId && (
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200
                            flex flex-col items-center justify-center gap-2 py-10 px-4 text-center
                            ${dragging
                                ? "border-violet-400 bg-violet-500/10 scale-[1.01]"
                                : "border-border hover:border-violet-400/60 hover:bg-violet-500/5"
                            }
                        `}
                    >
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-violet-500/20" : "bg-muted"}`}>
                            <FolderOpen className={`h-6 w-6 transition-colors ${dragging ? "text-violet-400" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Drop your PDF here</p>
                            <p className="text-xs text-muted-foreground mt-0.5">or <span className="text-violet-500 underline underline-offset-2">click to browse</span></p>
                        </div>
                        <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground/50 mt-1">PDF only</span>
                    </div>
                )}

                {/* ── STATE 2 : file chosen, not yet uploaded ── */}
                {file && !uploadedPdfId && (
                    <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-3">
                        {/* File row */}
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                                <FileText className="h-4 w-4 text-violet-500" />
                            </div>
                            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0" title={file.name}>
                                {file.name}
                            </span>
                            <button
                                onClick={handleClearFile}
                                className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>

                        {/* Name input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Document Name
                            </label>
                            <input
                                type="text"
                                value={documentName}
                                onChange={(e) => setDocumentName(e.target.value)}
                                placeholder="e.g. Claremont Addendum 01"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground
                                           placeholder:text-muted-foreground/40
                                           focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60
                                           transition-all"
                            />
                        </div>
                    </div>
                )}

                {/* ── STATE 3 : uploaded ── */}
                {uploadedPdfId && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Uploaded &amp; ready</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5" title={documentName}>{documentName}</p>
                        </div>
                        <button
                            onClick={handleClearFile}
                            className="text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border/60 rounded-md px-2 py-1 hover:bg-muted transition-all shrink-0"
                        >
                            Change
                        </button>
                    </div>
                )}

                {/* Hidden input */}
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />

                {/* ── Upload button (state 2 only) ── */}
                {file && !uploadedPdfId && (
                    <Button
                        onClick={handleUpload}
                        disabled={!canUpload || uploading}
                        className="w-full h-10 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white border-0 shadow-md shadow-violet-500/25 font-semibold text-sm"
                    >
                        {uploading
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
                            : <><Upload className="mr-2 h-4 w-4" />Upload PDF</>
                        }
                    </Button>
                )}

                {/* ── divider ── */}
                <div className="h-px bg-border/50" />

                {/* ── Process button ── */}
                <Button
                    onClick={handleProcess}
                    disabled={!isReady || loading}
                    className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/25 font-bold text-sm tracking-wide"
                >
                    {loading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
                        : <><Zap className="mr-2 h-4 w-4" />Extract Floor Plans</>
                    }
                </Button>

                {!isReady && (
                    <p className="text-[11px] text-muted-foreground/50 text-center -mt-1">
                        Upload a PDF above to unlock processing
                    </p>
                )}

            </div>
        </div>
    )
}
