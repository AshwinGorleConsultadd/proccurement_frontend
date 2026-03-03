import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { createBudgetItem, fetchBudgetItems } from '../../actions/budget/budgetActions'

export function useCreateBudgetItem() {
    const dispatch = useDispatch()
    const { projectId, loading, error, section, page, search, groupByPage, groupByRoom } =
        useSelector((state) => state.budget)

    const create = useCallback(
        async (data) => {
            const result = await dispatch(createBudgetItem({ projectId, data }))
            if (!result.error) {
                dispatch(fetchBudgetItems({ projectId, section, page, search, groupByPage, groupByRoom }))
            }
            return result
        },
        [dispatch, projectId, section, page, search, groupByPage, groupByRoom]
    )

    return { create, loading, error }
}
