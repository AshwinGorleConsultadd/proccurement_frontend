import { createSlice } from '@reduxjs/toolkit'
import {
    fetchProjects,
    fetchProject,
    createProject,
    deleteProject,
    fetchProjectPages,
    fetchAvailablePages,
    updateProjectPages,
    renameProject,
} from '../actions/project/projectActions'

// Helper: get the canonical id field (MongoDB uses _id as string)
const getId = (p) => p._id || p.id

const initialState = {
    projects: [],
    loading: false,
    error: null,
    // Single project fetched directly (includes selected_diagram_metadata)
    currentProject: null,
    currentProjectLoading: false,
    // Per-project page data cached by project _id
    projectPages: {},
    availablePages: {},
    pagesLoading: false,
    availableLoading: false,
    pagesUpdating: false,
}

const projectSlice = createSlice({
    name: 'projects',
    initialState,
    reducers: {
        clearProjectError(state) {
            state.error = null
        },
        clearProjectPages(state, action) {
            const id = action.payload
            delete state.projectPages[id]
            delete state.availablePages[id]
        },
        clearCurrentProject(state) {
            state.currentProject = null
        },
    },
    extraReducers: (builder) => {
        // ── Fetch single project ───────────────────────────────────────────
        builder
            .addCase(fetchProject.pending, (state) => {
                state.currentProjectLoading = true
                state.error = null
            })
            .addCase(fetchProject.fulfilled, (state, action) => {
                state.currentProjectLoading = false
                state.currentProject = action.payload
                // Keep projects list in sync
                const incoming = action.payload
                const idx = state.projects.findIndex(
                    (p) => getId(p) === getId(incoming)
                )
                if (idx !== -1) {
                    state.projects[idx] = { ...state.projects[idx], ...incoming }
                } else {
                    state.projects.unshift(incoming)
                }
            })
            .addCase(fetchProject.rejected, (state, action) => {
                state.currentProjectLoading = false
                state.error = action.payload || 'Failed to fetch project'
            })

        // ── Fetch all ──────────────────────────────────────────────────────
        builder
            .addCase(fetchProjects.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchProjects.fulfilled, (state, action) => {
                state.loading = false
                state.projects = action.payload
            })
            .addCase(fetchProjects.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Failed to fetch projects'
            })

        // ── Create ─────────────────────────────────────────────────────────
        builder
            .addCase(createProject.fulfilled, (state, action) => {
                state.projects.unshift(action.payload)
            })

        // ── Delete ─────────────────────────────────────────────────────────
        builder
            .addCase(deleteProject.fulfilled, (state, action) => {
                // action.payload is the deleted _id string
                state.projects = state.projects.filter(
                    (p) => getId(p) !== action.payload
                )
                if (state.currentProject && getId(state.currentProject) === action.payload) {
                    state.currentProject = null
                }
            })

        // ── Fetch project pages (saved images) ─────────────────────────────
        builder
            .addCase(fetchProjectPages.pending, (state) => {
                state.pagesLoading = true
            })
            .addCase(fetchProjectPages.fulfilled, (state, action) => {
                state.pagesLoading = false
                const { id, data } = action.payload
                state.projectPages[id] = data
            })
            .addCase(fetchProjectPages.rejected, (state) => {
                state.pagesLoading = false
            })

        // ── Fetch available pages ──────────────────────────────────────────
        builder
            .addCase(fetchAvailablePages.pending, (state) => {
                state.availableLoading = true
            })
            .addCase(fetchAvailablePages.fulfilled, (state, action) => {
                state.availableLoading = false
                const { id, data } = action.payload
                state.availablePages[id] = data
            })
            .addCase(fetchAvailablePages.rejected, (state) => {
                state.availableLoading = false
            })

        // ── Update pages (add / remove) ────────────────────────────────────
        builder
            .addCase(updateProjectPages.pending, (state) => {
                state.pagesUpdating = true
            })
            .addCase(updateProjectPages.fulfilled, (state, action) => {
                state.pagesUpdating = false
                const { id, data, add_filenames = [], remove_filenames = [] } = action.payload
                // data contains the full updated page list from backend
                state.projectPages[id] = data

                // Sync the current project object if it's the one being updated
                if (state.currentProject && getId(state.currentProject) === id) {
                    state.currentProject = {
                        ...state.currentProject,
                        selected_diagram_metadata: {
                            ...(state.currentProject.selected_diagram_metadata || {}),
                            images: data.images,
                            total: data.total_selected
                        }
                    }
                }

                // Optimistically update availablePages cache:
                // — remove newly-added images from available list (no backend refetch needed)
                if (state.availablePages[id] && add_filenames.length > 0) {
                    const addedSet = new Set(add_filenames)
                    const avail = (state.availablePages[id].images || []).filter(
                        img => !addedSet.has(img.filename)
                    )
                    state.availablePages[id] = { ...state.availablePages[id], images: avail }
                }

                // Update image count on the project in the list
                const proj = state.projects.find((p) => getId(p) === id)
                if (proj) proj.image_count = data.total_selected
            })
            .addCase(updateProjectPages.rejected, (state) => {
                state.pagesUpdating = false
            })

        // ── Rename project ─────────────────────────────────────────────────
        builder
            .addCase(renameProject.fulfilled, (state, action) => {
                const updated = action.payload
                const proj = state.projects.find((p) => getId(p) === getId(updated))
                if (proj) proj.name = updated.name
                if (state.currentProject && getId(state.currentProject) === getId(updated)) {
                    state.currentProject.name = updated.name
                }
            })
    },
})

export const { clearProjectError, clearProjectPages, clearCurrentProject } = projectSlice.actions
export default projectSlice.reducer
