import { createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../api/apiClient'

// ── Item CRUD ─────────────────────────────────────────────────────────────────

export const fetchBudgetItems = createAsyncThunk(
    'budget/fetchItems',
    async ({ projectId, section, page, search, roomFilter, groupByPage, groupByRoom }, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams({
                section: section || 'general',
                page: page || 1,
                search: search || '',
                rooms: roomFilter && roomFilter.length > 0 ? roomFilter.join(",") : '',
                group_by_page: groupByPage || false,
                group_by_room: groupByRoom || false,
            })
            const res = await api.get(`/budget/${projectId}?${params}`)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const createBudgetItem = createAsyncThunk(
    'budget/createItem',
    async ({ projectId, data }, { rejectWithValue }) => {
        try {
            const res = await api.post(`/budget/${projectId}/item`, data)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const updateBudgetItem = createAsyncThunk(
    'budget/updateItem',
    async ({ projectId, id, data }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/budget/${projectId}/item/${id}`, data)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const deleteBudgetItem = createAsyncThunk(
    'budget/deleteItem',
    async ({ projectId, id }, { rejectWithValue }) => {
        try {
            await api.delete(`/budget/${projectId}/item/${id}`)
            return id
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

// ── Sub-item actions ──────────────────────────────────────────────────────────

export const addSubItem = createAsyncThunk(
    'budget/addSubItem',
    async ({ projectId, itemId, data }, { rejectWithValue }) => {
        try {
            const res = await api.post(`/budget/${projectId}/item/${itemId}/subitems`, data)
            return res.data   // returns the updated parent item
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const updateSubItem = createAsyncThunk(
    'budget/updateSubItem',
    async ({ projectId, itemId, subId, data }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/budget/${projectId}/item/${itemId}/subitems/${subId}`, data)
            return res.data   // returns updated parent item
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const deleteSubItem = createAsyncThunk(
    'budget/deleteSubItem',
    async ({ projectId, itemId, subId }, { rejectWithValue }) => {
        try {
            const res = await api.delete(`/budget/${projectId}/item/${itemId}/subitems/${subId}`)
            return res.data   // returns updated parent
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const detachSubItem = createAsyncThunk(
    'budget/detachSubItem',
    async ({ projectId, itemId, subId }, { rejectWithValue }) => {
        try {
            const res = await api.post(`/budget/${projectId}/item/${itemId}/detach-subitem/${subId}`)
            return res.data   // { parent, new_item }
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const assignToParent = createAsyncThunk(
    'budget/assignToParent',
    async ({ projectId, itemId, parentId }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/budget/${projectId}/item/${itemId}/assign-to/${parentId}`)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

