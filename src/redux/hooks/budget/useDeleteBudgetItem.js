import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { deleteBudgetItem, fetchBudgetItems } from '../../actions/budget/budgetActions'

export function useDeleteBudgetItem() {
    const dispatch = useDispatch()
    const { projectId, loading, error, section, page, search, groupByPage, groupByRoom } =
        useSelector((state) => state.budget)

    const remove = useCallback(
        async (id) => {
            const result = await dispatch(deleteBudgetItem({ projectId, id }))
            if (!result.error) {
                dispatch(fetchBudgetItems({ projectId, section, page, search, groupByPage, groupByRoom }))
            }
            return result
        },
        [dispatch, projectId, section, page, search, groupByPage, groupByRoom]
    )

    return { remove, loading, error }
}
