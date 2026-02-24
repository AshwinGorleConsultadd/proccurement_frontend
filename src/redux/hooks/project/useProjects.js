import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import {
    fetchProjects,
    fetchProject,
    createProject,
    deleteProject,
    fetchProjectPages,
    fetchAvailablePages,
    updateProjectPages,
    renameProject,
} from '../../actions/project/projectActions'
import { clearProjectPages, clearCurrentProject } from '../../slices/projectSlice'

// Works with both MongoDB _id (string) and legacy SQLite id (number)
const getId = (p) => p?._id ?? p?.id

export function useProjects() {
    const dispatch = useDispatch()
    const {
        projects,
        loading,
        error,
        currentProject,
        currentProjectLoading,
        projectPages,
        availablePages,
        pagesLoading,
        availableLoading,
        pagesUpdating,
    } = useSelector((state) => state.projects)

    const load = useCallback(() => dispatch(fetchProjects()), [dispatch])

    const loadOne = useCallback(
        (id) => dispatch(fetchProject(id)),
        [dispatch]
    )

    const create = useCallback(
        (data) => dispatch(createProject(data)),
        [dispatch]
    )

    const remove = useCallback(
        (id) => dispatch(deleteProject(id)),
        [dispatch]
    )

    /** Download the selected_diagram_metadata from the MongoDB project document */
    const downloadMetadata = useCallback(
        async (project) => {
            const projectId = getId(project)
            if (!projectId) return
            const { api } = await import('../../api/apiClient')
            try {
                const res = await api.get(`/projects/${projectId}`)
                const data = res.data?.selected_diagram_metadata ?? res.data
                const blob = new Blob(
                    [JSON.stringify(data, null, 2)],
                    { type: 'application/json' }
                )
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${(project.name || 'project').replace(/\s+/g, '_')}_metadata.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            } catch (e) {
                console.error('[downloadMetadata] failed:', e)
            }
        },
        []
    )

    /** Load the saved pages for a project */
    const loadProjectPages = useCallback(
        (id) => dispatch(fetchProjectPages(id)),
        [dispatch]
    )

    /** Load all available pages (from sectioned_crops) for a project */
    const loadAvailablePages = useCallback(
        (id) => dispatch(fetchAvailablePages(id)),
        [dispatch]
    )

    /** Add / remove pages from a project and update the JSON on disk */
    const updatePages = useCallback(
        ({ id, add_filenames = [], remove_filenames = [], add_metadata = {} }) =>
            dispatch(updateProjectPages({ id, add_filenames, remove_filenames, add_metadata })),
        [dispatch]
    )

    /** Clear cached page data for a project (on modal close) */
    const clearPages = useCallback(
        (id) => dispatch(clearProjectPages(id)),
        [dispatch]
    )

    const rename = useCallback(
        (id, name) => dispatch(renameProject({ id, name })),
        [dispatch]
    )

    const clearCurrentProj = useCallback(
        () => dispatch(clearCurrentProject()),
        [dispatch]
    )

    return {
        projects,
        loading,
        error,
        currentProject,
        currentProjectLoading,
        projectPages,
        availablePages,
        pagesLoading,
        availableLoading,
        pagesUpdating,
        load,
        loadOne,
        create,
        remove,
        rename,
        downloadMetadata,
        loadProjectPages,
        loadAvailablePages,
        updatePages,
        clearPages,
        clearCurrentProj,
    }
}
