import { useState, useCallback } from "react"
import { api } from "../../api/apiClient"

export function useGetRooms(projectId) {
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchRooms = useCallback(async () => {
        if (!projectId) return
        setLoading(true)
        setError(null)
        try {
            const res = await api.get(`/rooms/project/${projectId}`)
            setRooms(res.data)
        } catch (err) {
            console.error("Failed to fetch rooms:", err)
            setError(err.response?.data?.detail || err.message)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    const createRoom = useCallback(async (data) => {
        if (!projectId) return null;
        try {
            const res = await api.post(`/rooms/project/${projectId}`, data);
            await fetchRooms(); // auto refetch
            return res.data;
        } catch (err) {
            console.error("Failed to create room:", err);
            setError(err.response?.data?.detail || err.message);
            return null;
        }
    }, [projectId, fetchRooms]);

    return { rooms, loading, error, fetchRooms, createRoom }
}
