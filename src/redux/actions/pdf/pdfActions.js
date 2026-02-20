import { createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../api/apiClient'

export const uploadPdf = createAsyncThunk(
    'pdf/uploadPdf',
    async ({ file, section = 'general' }, { rejectWithValue }) => {
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('section', section)
            // Must unset Content-Type so browser sets multipart/form-data + correct boundary
            const res = await api.post('/pdf/upload', formData, {
                headers: { 'Content-Type': undefined },
            })
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const fetchPdfs = createAsyncThunk(
    'pdf/fetchPdfs',
    async (section = 'general', { rejectWithValue }) => {
        try {
            const res = await api.get(`/pdf/list?section=${section}`)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const deletePdf = createAsyncThunk(
    'pdf/deletePdf',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/pdf/${id}`)
            return id
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)
