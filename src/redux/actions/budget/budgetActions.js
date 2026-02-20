import { createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../api/apiClient'

export const fetchBudgetItems = createAsyncThunk(
    'budget/fetchItems',
    async ({ section, page, search, groupByPage, groupByRoom }, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams({
                page: page || 1,
                search: search || '',
                group_by_page: groupByPage || false,
                group_by_room: groupByRoom || false,
            })
            const res = await api.get(`/budget/${section}?${params}`)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const createBudgetItem = createAsyncThunk(
    'budget/createItem',
    async (itemData, { rejectWithValue }) => {
        try {
            const res = await api.post('/budget/item', itemData)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const updateBudgetItem = createAsyncThunk(
    'budget/updateItem',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/budget/item/${id}`, data)
            return res.data
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)

export const deleteBudgetItem = createAsyncThunk(
    'budget/deleteItem',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/budget/item/${id}`)
            return id
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || err.message)
        }
    }
)
