import { useDispatch, useSelector } from 'react-redux'
import { toggleSidebar, setSidebarOpen, toggleMobileSidebar, setMobileSidebarOpen, addNotification, removeNotification } from '../../slices/uiSlice'

export function useUI() {
    const dispatch = useDispatch()
    const { sidebarOpen, sidebarMobileOpen, notifications } = useSelector((state) => state.ui)

    return {
        sidebarOpen,
        sidebarMobileOpen,
        notifications,
        toggleSidebar: () => dispatch(toggleSidebar()),
        setSidebarOpen: (val) => dispatch(setSidebarOpen(val)),
        toggleMobileSidebar: () => dispatch(toggleMobileSidebar()),
        setMobileSidebarOpen: (val) => dispatch(setMobileSidebarOpen(val)),
        notify: (msg, type = 'info') =>
            dispatch(addNotification({ message: msg, type })),
        dismissNotification: (id) => dispatch(removeNotification(id)),
    }
}
