import { createSlice } from '@reduxjs/toolkit'
import {
    fetchBudgetItems,
    createBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
} from '../actions/budget/budgetActions'

const initialState = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 12,
    totalSubtotal: 0,
    loading: false,
    error: null,
    editingRowId: null,
    search: '',
    groupByPage: false,
    groupByRoom: false,
    section: 'general',
}

const budgetSlice = createSlice({
    name: 'budget',
    initialState,
    reducers: {
        setEditingRowId(state, action) {
            state.editingRowId = action.payload
        },
        setSearch(state, action) {
            state.search = action.payload
            state.page = 1
        },
        setPage(state, action) {
            state.page = action.payload
        },
        setGroupByPage(state, action) {
            state.groupByPage = action.payload
            state.groupByRoom = false
            state.page = 1
        },
        setGroupByRoom(state, action) {
            state.groupByRoom = action.payload
            state.groupByPage = false
            state.page = 1
        },
        setSection(state, action) {
            state.section = action.payload
            state.page = 1
        },
        clearError(state) {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        // Fetch
        builder
            .addCase(fetchBudgetItems.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchBudgetItems.fulfilled, (state, action) => {
                state.loading = false
                state.items = action.payload.items
                state.total = action.payload.total
                state.page = action.payload.page
                state.pageSize = action.payload.page_size
                state.totalSubtotal = action.payload.total_subtotal
            })
            .addCase(fetchBudgetItems.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Failed to fetch budget items'
            })

        // Create
        builder
            .addCase(createBudgetItem.pending, (state) => {
                state.loading = true
            })
            .addCase(createBudgetItem.fulfilled, (state) => {
                state.loading = false
            })
            .addCase(createBudgetItem.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Failed to create item'
            })

        // Update
        builder
            .addCase(updateBudgetItem.pending, (state) => {
                state.loading = true
            })
            .addCase(updateBudgetItem.fulfilled, (state, action) => {
                state.loading = false
                const idx = state.items.findIndex((i) => i.id === action.payload.id)
                if (idx !== -1) state.items[idx] = action.payload
            })
            .addCase(updateBudgetItem.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Failed to update item'
            })

        // Delete
        builder
            .addCase(deleteBudgetItem.pending, (state) => {
                state.loading = true
            })
            .addCase(deleteBudgetItem.fulfilled, (state, action) => {
                state.loading = false
                state.items = state.items.filter((i) => i.id !== action.payload)
            })
            .addCase(deleteBudgetItem.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Failed to delete item'
            })
    },
})

export const {
    setEditingRowId,
    setSearch,
    setPage,
    setGroupByPage,
    setGroupByRoom,
    setSection,
    clearError,
} = budgetSlice.actions

export default budgetSlice.reducer
