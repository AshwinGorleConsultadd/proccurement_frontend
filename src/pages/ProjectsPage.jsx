import { ProjectsSection } from "../components/ProjectsSection"

export function ProjectsPage() {
    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
            </div>
            <ProjectsSection />
        </div>
    )
}
