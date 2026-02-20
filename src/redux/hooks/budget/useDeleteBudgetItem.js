import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { deleteBudgetItem } from '../../actions/budget/budgetActions'
import { fetchBudgetItems } from '../../actions/budget/budgetActions'

export function useDeleteBudgetItem() {
    const dispatch = useDispatch()
    const { loading, error, section, page, search, groupByPage, groupByRoom } = useSelector(
        (state) => state.budget
    )

    const remove = useCallback(
        async (id) => {
            const result = await dispatch(deleteBudgetItem(id))
            if (!result.error) {
                dispatch(fetchBudgetItems({ section, page, search, groupByPage, groupByRoom }))
            }
            return result
        },
        [dispatch, section, page, search, groupByPage, groupByRoom]
    )

    return { remove, loading, error }
}
