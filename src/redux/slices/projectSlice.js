import { createSlice } from '@reduxjs/toolkit'
import {
    fetchProjects,
    createProject,
    deleteProject,
    fetchProjectMetadata,
    fetchProjectPages,
    fetchAvailablePages,
    updateProjectPages,
    renameProject,
} from '../actions/project/projectActions'

const initialState = {
    projects: [],
    loading: false,
    error: null,
    // Per-project page data cached by project id
    projectPages: {},           // { [id]: { images, total_selected } }
    availablePages: {},         // { [id]: { images, total } }
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
    },
    extraReducers: (builder) => {
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
                state.projects.unshift(action.payload)  // newest at top
            })

        // ── Delete ─────────────────────────────────────────────────────────
        builder
            .addCase(deleteProject.fulfilled, (state, action) => {
                state.projects = state.projects.filter((p) => p.id !== action.payload)
            })

        // ── Fetch metadata (no-op in state — caller uses returned value) ───
        builder
            .addCase(fetchProjectMetadata.rejected, (state, action) => {
                state.error = action.payload
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

        // ── Fetch available pages (all from sectioned_crops) ───────────────
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
                const { id, data } = action.payload
                // Update the cached page data
                state.projectPages[id] = data
                // Update image_count in the projects list
                const proj = state.projects.find((p) => p.id === id)
                if (proj) proj.image_count = data.total_selected
            })
            .addCase(updateProjectPages.rejected, (state) => {
                state.pagesUpdating = false
            })
        // ── Rename project ─────────────────────────────────────────────────
        builder
            .addCase(renameProject.fulfilled, (state, action) => {
                const updated = action.payload
                const proj = state.projects.find((p) => p.id === updated.id)
                if (proj) proj.name = updated.name
            })
    },
})

export const { clearProjectError, clearProjectPages } = projectSlice.actions
export default projectSlice.reducer
