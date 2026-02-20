import { useDispatch, useSelector } from 'react-redux'
import { useCallback, useEffect } from 'react'
import { fetchBudgetItems } from '../../actions/budget/budgetActions'

export function useGetBudgetItems() {
    const dispatch = useDispatch()
    const { items, total, page, pageSize, totalSubtotal, loading, error, search, groupByPage, groupByRoom, section } =
        useSelector((state) => state.budget)

    const fetch = useCallback(() => {
        dispatch(fetchBudgetItems({ section, page, search, groupByPage, groupByRoom }))
    }, [dispatch, section, page, search, groupByPage, groupByRoom])

    useEffect(() => {
        fetch()
    }, [fetch])

    return { items, total, page, pageSize, totalSubtotal, loading, error, refetch: fetch }
}
