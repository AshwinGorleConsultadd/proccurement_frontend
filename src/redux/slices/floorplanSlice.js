import { createSlice } from '@reduxjs/toolkit'
import {
    startProcessing,
    pollJobStatus,
    fetchJobImages,
    saveSelectedImages,
    fetchJobs,
} from '../actions/floorplan/floorplanActions'

const initialState = {
    jobs: [],
    currentJob: null,
    images: [],
    selectedImages: {},   // filename -> true
    savedMetadata: null,
    loading: false,
    polling: false,
    error: null,
}

const floorplanSlice = createSlice({
    name: 'floorplan',
    initialState,
    reducers: {
        toggleImageSelection(state, action) {
            const name = action.payload
            if (state.selectedImages[name]) {
                delete state.selectedImages[name]
            } else {
                state.selectedImages[name] = true
            }
        },
        selectAllImages(state) {
            state.images.forEach((img) => {
                state.selectedImages[img.filename] = true
            })
        },
        clearSelection(state) {
            state.selectedImages = {}
        },
        clearJob(state) {
            state.currentJob = null
            state.images = []
            state.selectedImages = {}
            state.savedMetadata = null
        },
        setCurrentJob(state, action) {
            state.currentJob = action.payload
        },
        clearFloorplanError(state) {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(startProcessing.pending, (state) => {
                state.loading = true
                state.error = null
                state.images = []
                state.selectedImages = {}
                state.savedMetadata = null
            })
            .addCase(startProcessing.fulfilled, (state, action) => {
                state.loading = false
                state.currentJob = action.payload
            })
            .addCase(startProcessing.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Failed to start processing'
            })

        builder
            .addCase(pollJobStatus.fulfilled, (state, action) => {
                state.currentJob = action.payload
            })

        builder
            .addCase(fetchJobImages.pending, (state) => {
                state.loading = true
            })
            .addCase(fetchJobImages.fulfilled, (state, action) => {
                state.loading = false
                state.images = action.payload.images || []
            })
            .addCase(fetchJobImages.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

        builder
            .addCase(saveSelectedImages.pending, (state) => {
                state.loading = true
            })
            .addCase(saveSelectedImages.fulfilled, (state, action) => {
                state.loading = false
                state.savedMetadata = action.payload
            })
            .addCase(saveSelectedImages.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

        builder
            .addCase(fetchJobs.fulfilled, (state, action) => {
                state.jobs = action.payload
            })
    },
})

export const {
    toggleImageSelection,
    selectAllImages,
    clearSelection,
    clearJob,
    clearFloorplanError,
    setCurrentJob,
} = floorplanSlice.actions

export default floorplanSlice.reducer
