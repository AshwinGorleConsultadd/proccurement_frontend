import { createSlice } from '@reduxjs/toolkit'
import { uploadPdf, fetchPdfs, deletePdf } from '../actions/pdf/pdfActions'

const initialState = {
    documents: [],
    uploading: false,
    uploadProgress: 0,
    loading: false,
    error: null,
}

const pdfSlice = createSlice({
    name: 'pdf',
    initialState,
    reducers: {
        setUploadProgress(state, action) {
            state.uploadProgress = action.payload
        },
        clearPdfError(state) {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        // Upload
        builder
            .addCase(uploadPdf.pending, (state) => {
                state.uploading = true
                state.uploadProgress = 0
                state.error = null
            })
            .addCase(uploadPdf.fulfilled, (state, action) => {
                state.uploading = false
                state.uploadProgress = 100
                state.documents.unshift(action.payload)
            })
            .addCase(uploadPdf.rejected, (state, action) => {
                state.uploading = false
                state.error = action.payload || 'Upload failed'
            })

        // Fetch
        builder
            .addCase(fetchPdfs.pending, (state) => {
                state.loading = true
            })
            .addCase(fetchPdfs.fulfilled, (state, action) => {
                state.loading = false
                state.documents = action.payload
            })
            .addCase(fetchPdfs.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Failed to fetch PDFs'
            })

        // Delete
        builder
            .addCase(deletePdf.fulfilled, (state, action) => {
                state.documents = state.documents.filter((d) => d.id !== action.payload)
            })
    },
})

export const { setUploadProgress, clearPdfError } = pdfSlice.actions
export default pdfSlice.reducer
