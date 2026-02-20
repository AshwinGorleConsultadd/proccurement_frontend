import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useProjects } from "../redux/hooks/project/useProjects"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import {
    FolderOpen,
    Plus,
    Trash2,
    Download,
    FileJson,
    CalendarDays,
    Images,
    FileText,
    Loader2,
    ExternalLink,
} from "lucide-react"
import { ProjectDetailModal } from "./ProjectDetailModal"

function formatDate(iso) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    })
}

export function ProjectsSection() {
    const navigate = useNavigate()
    const { projects, loading, remove, downloadMetadata, load } = useProjects()
    const [deletingId, setDeletingId] = useState(null)
    const [downloadingId, setDownloadingId] = useState(null)
    const [activeProject, setActiveProject] = useState(null) // project object for the modal

    useEffect(() => {
        load()
    }, [load])

    const handleDelete = async (e, id) => {
        e.stopPropagation()
        setDeletingId(id)
        await remove(id)
        setDeletingId(null)
    }

    const handleDownload = async (e, project) => {
        e.stopPropagation()
        if (!project.metadata_path) return
        setDownloadingId(project.id)
        await downloadMetadata(project)
        setDownloadingId(null)
    }

    return (
        <>
            <Card className="col-span-full">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                <FolderOpen className="h-5 w-5 text-violet-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Projects</CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Floor plan processing results saved here
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="gap-1.5 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white border-0 shadow-md shadow-violet-500/20"
                            onClick={() => navigate("/floor-plans")}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New Project
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading projects…</span>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-12 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-violet-500/8 flex items-center justify-center mb-4">
                                <FolderOpen className="h-7 w-7 text-violet-400/40" />
                            </div>
                            <p className="text-sm font-medium mb-1">No projects yet</p>
                            <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                                Upload a PDF in Floor Plans, process it, select images and save — it will appear here automatically.
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => navigate("/floor-plans")}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Go to Floor Plans
                            </Button>
                        </div>
                    )}

                    {/* Projects grid */}
                    {!loading && projects.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {projects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setActiveProject(project)}
                                    className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card hover:border-violet-500/40 hover:bg-violet-500/5 transition-all duration-200 p-4 cursor-pointer"
                                >
                                    {/* Open indicator */}
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink className="h-3.5 w-3.5 text-violet-400" />
                                    </div>

                                    {/* Project icon + name */}
                                    <div className="flex items-start gap-3">
                                        <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
                                            <FileJson className="h-5 w-5 text-violet-400" />
                                        </div>
                                        <div className="min-w-0 flex-1 pr-5">
                                            <p className="font-semibold text-sm leading-tight truncate" title={project.name}>
                                                {project.name}
                                            </p>
                                            {project.pdf_name && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <span className="text-xs text-muted-foreground truncate" title={project.pdf_name}>
                                                        {project.pdf_name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Images className="h-3 w-3" />
                                            <span>{project.image_count} image{project.image_count !== 1 ? "s" : ""}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            <span>{formatDate(project.created_at)}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 h-7 text-xs gap-1 border-violet-500/20 text-violet-500 hover:bg-violet-500/10 hover:border-violet-500/40 disabled:opacity-40"
                                            disabled={!project.metadata_path || downloadingId === project.id}
                                            onClick={(e) => handleDownload(e, project)}
                                            title={project.metadata_path ? "Download JSON metadata" : "No metadata available"}
                                        >
                                            {downloadingId === project.id
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <Download className="h-3 w-3" />
                                            }
                                            JSON
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                                            disabled={deletingId === project.id}
                                            onClick={(e) => handleDelete(e, project.id)}
                                            title="Delete project"
                                        >
                                            {deletingId === project.id
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <Trash2 className="h-3.5 w-3.5" />
                                            }
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Project detail modal */}
            {activeProject && (
                <ProjectDetailModal
                    project={activeProject}
                    onClose={() => {
                        setActiveProject(null)
                        // Refresh the project list to reflect any image_count changes
                        load()
                    }}
                />
            )}
        </>
    )
}
