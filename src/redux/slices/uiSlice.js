import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    sidebarOpen: false,
    sidebarMobileOpen: false,
    theme: 'dark',
    notifications: [],
}

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        toggleSidebar(state) {
            state.sidebarOpen = !state.sidebarOpen
        },
        setSidebarOpen(state, action) {
            state.sidebarOpen = action.payload
        },
        toggleMobileSidebar(state) {
            state.sidebarMobileOpen = !state.sidebarMobileOpen
        },
        setMobileSidebarOpen(state, action) {
            state.sidebarMobileOpen = action.payload
        },
        addNotification(state, action) {
            state.notifications.push({
                id: Date.now(),
                ...action.payload,
            })
        },
        removeNotification(state, action) {
            state.notifications = state.notifications.filter(
                (n) => n.id !== action.payload
            )
        },
    },
})

export const {
    toggleSidebar,
    setSidebarOpen,
    toggleMobileSidebar,
    setMobileSidebarOpen,
    addNotification,
    removeNotification,
} = uiSlice.actions

export default uiSlice.reducer
