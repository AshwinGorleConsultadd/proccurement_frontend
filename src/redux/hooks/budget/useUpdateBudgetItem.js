import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { updateBudgetItem } from '../../actions/budget/budgetActions'

export function useUpdateBudgetItem() {
    const dispatch = useDispatch()
    const { loading, error } = useSelector((state) => state.budget)

    const update = useCallback(
        async (id, data) => {
            return dispatch(updateBudgetItem({ id, data }))
        },
        [dispatch]
    )

    return { update, loading, error }
}
