import { useDispatch, useSelector } from 'react-redux'
import { useCallback, useEffect } from 'react'
import { fetchBudgetItems } from '../../actions/budget/budgetActions'

export function useGetBudgetItems() {
    const dispatch = useDispatch()
    const {
        projectId, items, total, page, pageSize,
        totalSubtotal, roomTotals, loading, error,
        search, roomFilter, groupByPage, groupByRoom, section,
    } = useSelector((state) => state.budget)

    const fetch = useCallback(() => {
        if (!projectId) return
        dispatch(fetchBudgetItems({ projectId, section, page, search, roomFilter, groupByPage, groupByRoom }))
    }, [dispatch, projectId, section, page, search, roomFilter, groupByPage, groupByRoom])

    useEffect(() => {
        fetch()
    }, [fetch])

    return { items, total, page, pageSize, totalSubtotal, roomTotals, loading, error, refetch: fetch }
}
