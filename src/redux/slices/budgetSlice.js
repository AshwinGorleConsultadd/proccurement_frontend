import { createSlice } from '@reduxjs/toolkit'
import {
    fetchBudgetItems,
    createBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    addSubItem,
    updateSubItem,
    deleteSubItem,
    detachSubItem,
} from '../actions/budget/budgetActions'

const initialState = {
    projectId: null,
    items: [],
    total: 0,
    page: 1,
    pageSize: 12,
    totalSubtotal: 0,
    roomTotals: {},
    loading: false,
    error: null,
    editingRowId: null,
    search: '',
    roomFilter: [],
    groupByPage: false,
    groupByRoom: false,
    section: 'general',
}

/** Helper: replace one item in the list by _id */
function replaceItem(items, updated) {
    const idx = items.findIndex((i) => i._id === updated._id)
    if (idx !== -1) {
        items[idx] = updated
    }
    return items
}

const budgetSlice = createSlice({
    name: 'budget',
    initialState,
    reducers: {
        setProjectId(state, action) {
            if (state.projectId !== action.payload) {
                state.projectId = action.payload
                state.items = []
                state.page = 1
            }
        },
        setEditingRowId(state, action) { state.editingRowId = action.payload },
        setSearch(state, action) { state.search = action.payload; state.page = 1 },
        setRoomFilter(state, action) { state.roomFilter = action.payload; state.page = 1 },
        setPage(state, action) { state.page = action.payload },
        setGroupByPage(state, action) { state.groupByPage = action.payload; state.groupByRoom = false; state.page = 1 },
        setGroupByRoom(state, action) { state.groupByRoom = action.payload; state.groupByPage = false; state.page = 1 },
        setSection(state, action) { state.section = action.payload; state.page = 1 },
        clearError(state) { state.error = null },
    },
    extraReducers: (builder) => {
        // ── Fetch ──────────────────────────────────────────────────────────
        builder
            .addCase(fetchBudgetItems.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchBudgetItems.fulfilled, (s, a) => {
                s.loading = false
                s.items = a.payload.items
                s.total = a.payload.total
                s.page = a.payload.page
                s.pageSize = a.payload.page_size
                s.totalSubtotal = a.payload.total_subtotal
                s.roomTotals = a.payload.room_totals || {}
            })
            .addCase(fetchBudgetItems.rejected, (s, a) => {
                s.loading = false
                s.error = a.payload || 'Failed to fetch budget items'
            })

        // ── Create ────────────────────────────────────────────────────────
        builder
            .addCase(createBudgetItem.pending, (s) => { s.loading = true })
            .addCase(createBudgetItem.fulfilled, (s) => { s.loading = false })
            .addCase(createBudgetItem.rejected, (s, a) => { s.loading = false; s.error = a.payload || 'Failed to create item' })

        // ── Update ────────────────────────────────────────────────────────
        builder
            .addCase(updateBudgetItem.pending, (s) => { s.loading = true })
            .addCase(updateBudgetItem.fulfilled, (s, a) => {
                s.loading = false
                replaceItem(s.items, a.payload)
            })
            .addCase(updateBudgetItem.rejected, (s, a) => { s.loading = false; s.error = a.payload || 'Failed to update item' })

        // ── Delete ────────────────────────────────────────────────────────
        builder
            .addCase(deleteBudgetItem.pending, (s) => { s.loading = true })
            .addCase(deleteBudgetItem.fulfilled, (s, a) => {
                s.loading = false
                s.items = s.items.filter((i) => i._id !== a.payload)
            })
            .addCase(deleteBudgetItem.rejected, (s, a) => { s.loading = false; s.error = a.payload || 'Failed to delete item' })

        // ── Sub-item add ──────────────────────────────────────────────────
        builder
            .addCase(addSubItem.fulfilled, (s, a) => { replaceItem(s.items, a.payload) })
            .addCase(addSubItem.rejected, (s, a) => { s.error = a.payload })

        // ── Sub-item update ───────────────────────────────────────────────
        builder
            .addCase(updateSubItem.fulfilled, (s, a) => { replaceItem(s.items, a.payload) })
            .addCase(updateSubItem.rejected, (s, a) => { s.error = a.payload })

        // ── Sub-item delete ───────────────────────────────────────────────
        builder
            .addCase(deleteSubItem.fulfilled, (s, a) => { replaceItem(s.items, a.payload) })
            .addCase(deleteSubItem.rejected, (s, a) => { s.error = a.payload })

        // ── Sub-item detach ───────────────────────────────────────────────
        builder
            .addCase(detachSubItem.fulfilled, (s, a) => {
                const { parent, new_item } = a.payload
                replaceItem(s.items, parent)
                // Insert new top-level item after the parent
                const parentIdx = s.items.findIndex((i) => i._id === parent._id)
                if (parentIdx !== -1) {
                    s.items.splice(parentIdx + 1, 0, new_item)
                } else {
                    s.items.push(new_item)
                }
            })
            .addCase(detachSubItem.rejected, (s, a) => { s.error = a.payload })
    },
})

export const {
    setProjectId,
    setEditingRowId,
    setSearch,
    setRoomFilter,
    setPage,
    setGroupByPage,
    setGroupByRoom,
    setSection,
    clearError,
} = budgetSlice.actions

export default budgetSlice.reducer
