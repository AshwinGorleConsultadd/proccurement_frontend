import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import {
    fetchProjects,
    createProject,
    deleteProject,
    fetchProjectMetadata,
    fetchProjectPages,
    fetchAvailablePages,
    updateProjectPages,
} from '../../actions/project/projectActions'
import { clearProjectPages } from '../../slices/projectSlice'

export function useProjects() {
    const dispatch = useDispatch()
    const {
        projects,
        loading,
        error,
        projectPages,
        availablePages,
        pagesLoading,
        availableLoading,
        pagesUpdating,
    } = useSelector((state) => state.projects)

    const load = useCallback(() => dispatch(fetchProjects()), [dispatch])

    const create = useCallback(
        (data) => dispatch(createProject(data)),
        [dispatch]
    )

    const remove = useCallback(
        (id) => dispatch(deleteProject(id)),
        [dispatch]
    )

    /** Fetch metadata JSON and trigger a browser download */
    const downloadMetadata = useCallback(
        async (project) => {
            const result = await dispatch(fetchProjectMetadata(project.id))
            if (result?.payload?.data) {
                const blob = new Blob(
                    [JSON.stringify(result.payload.data, null, 2)],
                    { type: 'application/json' }
                )
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${project.name.replace(/\s+/g, '_')}_metadata.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }
        },
        [dispatch]
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
        ({ id, add_filenames = [], remove_filenames = [] }) =>
            dispatch(updateProjectPages({ id, add_filenames, remove_filenames })),
        [dispatch]
    )

    /** Clear cached page data for a project (on modal close) */
    const clearPages = useCallback(
        (id) => dispatch(clearProjectPages(id)),
        [dispatch]
    )

    return {
        projects,
        loading,
        error,
        projectPages,
        availablePages,
        pagesLoading,
        availableLoading,
        pagesUpdating,
        load,
        create,
        remove,
        downloadMetadata,
        loadProjectPages,
        loadAvailablePages,
        updatePages,
        clearPages,
    }
}
