import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { createBudgetItem } from '../../actions/budget/budgetActions'
import { fetchBudgetItems } from '../../actions/budget/budgetActions'

export function useCreateBudgetItem() {
    const dispatch = useDispatch()
    const { loading, error, section, page, search, groupByPage, groupByRoom } = useSelector(
        (state) => state.budget
    )

    const create = useCallback(
        async (itemData) => {
            const result = await dispatch(createBudgetItem(itemData))
            if (!result.error) {
                dispatch(fetchBudgetItems({ section, page, search, groupByPage, groupByRoom }))
            }
            return result
        },
        [dispatch, section, page, search, groupByPage, groupByRoom]
    )

    return { create, loading, error }
}
