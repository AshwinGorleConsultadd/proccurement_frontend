import { useEffect, useState } from "react"
import { useFloorplan } from "../redux/hooks/floorplan/useFloorplan"
import { usePdf } from "../redux/hooks/pdf/usePdf"
import { useProjects } from "../redux/hooks/project/useProjects"
import { FloorPlanSettings } from "../components/floorplan/FloorPlanSettings"
import { ProcessingStatus } from "../components/floorplan/ProcessingStatus"
import { ImageGrid } from "../components/floorplan/ImageGrid"
import { SelectionSummary } from "../components/floorplan/SelectionSummary"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Separator } from "../components/ui/separator"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { FileText, RotateCcw, Images, Cpu, FolderPlus } from "lucide-react"

export function FloorPlanPage() {
    const {
        currentJob, images, selectedImages, savedMetadata, loading, error,
        start, saveSelected, toggleSelect, selectAll, clearSel, reset, loadJobs
    } = useFloorplan()

    const { documents, fetchAll, upload } = usePdf()
    const { create: createProject } = useProjects()

    // Project name the user types before saving
    const [projectName, setProjectName] = useState("")
    const [projectSaved, setProjectSaved] = useState(false)

    useEffect(() => {
        fetchAll("general")
        loadJobs()
        // Cleanup on unmount to ensure a fresh start next time
        return () => reset()
    }, [])

    // Reset project-saved badge when a new job starts
    useEffect(() => {
        setProjectSaved(false)
        setProjectName("")
    }, [currentJob?.id])

    const handleProcess = async (pdfId, dpi, minAreaPct) => {
        await start(pdfId, dpi, minAreaPct)
    }

    const handleSaveSelection = async () => {
        if (Object.keys(selectedImages).length === 0 || !currentJob) return

        // 1. Save the selected images via the existing floorplan save endpoint
        const result = await saveSelected(currentJob.id)

        // 2. Once that succeeds, create a Project record
        // savedMetadata comes back on the next render, so use the thunk payload
        const metadata = result?.payload ?? null

        // Build project name: use user input, or fall back to PDF name / timestamp
        const pdfDoc = documents.find((d) => d.id === currentJob.pdf_id)
        const pdfName = pdfDoc?.original_name ?? pdfDoc?.filename ?? null
        const finalName =
            projectName.trim() ||
            (pdfName ? pdfName.replace(/\.pdf$/i, "") : `Project ${new Date().toLocaleDateString()}`)

        await createProject({
            name: finalName,
            pdf_name: pdfName,
            job_id: currentJob.id,
            image_count: Object.keys(selectedImages).length,
            // metadata_path is the absolute path stored by the backend's save-selected endpoint
            metadata_path: metadata?.images?.[0]?.original_path
                ? (() => {
                    // reconstruct: the dir is `job_dir/sectioned_crops/selected_images/`
                    // the JSON is at `selected_images_metadata.json` in that dir
                    const firstPath = metadata.images[0].saved_path
                    const dir = firstPath.substring(0, firstPath.lastIndexOf("/"))
                    return `${dir}/selected_images_metadata.json`
                })()
                : null,
        })

        setProjectSaved(true)

        // Refresh the section like a new one after a short delay
        setTimeout(() => {
            reset()
            setProjectSaved(false)
            setProjectName("")
        }, 2000)
    }

    return (
        <div className="p-6 lg:p-8 space-y-6 pb-32 max-w-[1600px] mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Cpu className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Floor Plan Processor</h1>
                    </div>
                    <p className="text-sm text-muted-foreground ml-11">
                        Upload architectural PDFs, extract diagrams with AI, and export selections.
                    </p>
                </div>
                {(currentJob || images.length > 0) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={reset}
                        className="shrink-0 gap-1.5"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        New Job
                    </Button>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl border border-destructive/20 text-sm font-medium">
                    ⚠️ {error}
                </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar Settings Panel */}
                <div className="lg:col-span-1">
                    <FloorPlanSettings
                        onProcess={handleProcess}
                        loading={loading && (!currentJob || currentJob.status === "pending")}
                        pdfs={documents}
                        onUpload={upload}
                    />
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Processing Status Card */}
                    {currentJob && (
                        <Card className="border-primary/20 bg-gradient-to-br from-primary/3 to-transparent">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-base">Processing Status</CardTitle>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
                                        #{currentJob.id}
                                    </span>
                                </div>
                                {currentJob.pdf_name && (
                                    <CardDescription className="flex items-center gap-1.5 mt-1">
                                        <FileText className="h-3.5 w-3.5" />
                                        {currentJob.pdf_name}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                <ProcessingStatus job={currentJob} />
                            </CardContent>
                        </Card>
                    )}

                    {/* Results Grid */}
                    {images.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Images className="h-5 w-5 text-primary" />
                                    <h2 className="text-lg font-semibold">
                                        Extracted Diagrams
                                        <span className="ml-2 text-sm font-normal text-muted-foreground">({images.length} found)</span>
                                    </h2>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={selectAll} className="h-8 text-xs">
                                        Select All
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={clearSel} className="h-8 text-xs text-muted-foreground">
                                        Clear
                                    </Button>
                                </div>
                            </div>
                            <Separator />
                            <ImageGrid images={images} selected={selectedImages} onSelect={toggleSelect} />
                        </div>
                    )}

                    {/* Project name input — shown once images are ready */}
                    {images.length > 0 && !projectSaved && (
                        <Card className="border-violet-500/20 bg-violet-500/5">
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                        <FolderPlus className="h-4 w-4 text-violet-500" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1">
                                            Project Name (optional)
                                        </p>
                                        <Input
                                            placeholder="e.g. Claremont Grafton Floor Plans"
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            className="h-8 text-sm border-violet-500/20 focus-visible:ring-violet-500/40"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground max-w-[160px] leading-relaxed">
                                        Saved to Projects on dashboard after clicking Save Selected.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {!currentJob && images.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-16 text-center bg-muted/20 min-h-[400px]">
                            <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center mb-5">
                                <FileText className="h-8 w-8 text-primary/40" />
                            </div>
                            <h3 className="text-base font-semibold mb-2">No processing job active</h3>
                            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                                Upload a PDF in the panel on the left and click <strong>"Start Processing"</strong> to extract floor plan diagrams.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Footer for Selection */}
            <SelectionSummary
                selectedCount={Object.keys(selectedImages).length}
                totalCount={images.length}
                onSave={handleSaveSelection}
                savedMetadata={savedMetadata}
                saved={!!savedMetadata}
                projectSaved={projectSaved}
            />
        </div>
    )
}
