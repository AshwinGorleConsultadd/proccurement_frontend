import { Button } from "../ui/button"
import { Download, Save, CheckCheck, Images, FolderCheck } from "lucide-react"

export function SelectionSummary({ selectedCount, totalCount, onSave, savedMetadata, saved, projectSaved }) {
    // Only render when there are images to show
    if (totalCount === 0) return null

    const handleDownload = () => {
        if (!savedMetadata) return
        const blob = new Blob([JSON.stringify(savedMetadata, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `selected_images_metadata_${new Date().getTime()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="fixed bottom-0 right-0 left-[4.5rem] z-50 pointer-events-none">
            <div className="max-w-[1600px] mx-auto px-6 pb-4 pointer-events-none">
                <div className="pointer-events-auto bg-background/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl px-5 py-3.5 flex items-center justify-between gap-4">
                    {/* Left — counts */}
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Images className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground leading-none mb-0.5">Selection</p>
                            <p className="text-sm font-bold leading-none">
                                <span className="text-primary">{selectedCount}</span>
                                <span className="text-muted-foreground font-normal"> / {totalCount} images</span>
                            </p>
                        </div>

                        {saved && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-2.5 py-1.5">
                                <CheckCheck className="h-3.5 w-3.5" />
                                Saved!
                            </div>
                        )}

                        {projectSaved && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 rounded-lg px-2.5 py-1.5">
                                <FolderCheck className="h-3.5 w-3.5" />
                                Project Saved!
                            </div>
                        )}
                    </div>

                    {/* Right — actions */}
                    <div className="flex items-center gap-2">
                        {savedMetadata && (
                            <Button
                                onClick={handleDownload}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download JSON
                            </Button>
                        )}
                        <Button
                            onClick={onSave}
                            disabled={selectedCount === 0}
                            size="sm"
                            className="h-8 text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-md shadow-emerald-500/20 font-semibold disabled:opacity-40"
                        >
                            <Save className="h-3.5 w-3.5" />
                            Save Selected {selectedCount > 0 ? `(${selectedCount})` : ""}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
