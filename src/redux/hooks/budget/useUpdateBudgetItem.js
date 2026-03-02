import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { updateBudgetItem } from '../../actions/budget/budgetActions'

export function useUpdateBudgetItem() {
    const dispatch = useDispatch()
    const { projectId, loading, error } = useSelector((state) => state.budget)

    const update = useCallback(
        async (id, data) => dispatch(updateBudgetItem({ projectId, id, data })),
        [dispatch, projectId]
    )

    return { update, loading, error }
}
