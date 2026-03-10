import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { addSubItem, updateSubItem, deleteSubItem, detachSubItem, assignToParent, fetchBudgetItems } from '../../actions/budget/budgetActions'

export function useSubItems() {
    const dispatch = useDispatch()
    const { projectId, section, page, search, groupByPage, groupByRoom } = useSelector((state) => state.budget)

    const addSub = useCallback(
        (itemId, data) => dispatch(addSubItem({ projectId, itemId, data })),
        [dispatch, projectId]
    )

    const updateSub = useCallback(
        (itemId, subId, data) => dispatch(updateSubItem({ projectId, itemId, subId, data })),
        [dispatch, projectId]
    )

    const deleteSub = useCallback(
        (itemId, subId) => dispatch(deleteSubItem({ projectId, itemId, subId })),
        [dispatch, projectId]
    )

    const detachSub = useCallback(
        (itemId, subId) => dispatch(detachSubItem({ projectId, itemId, subId })),
        [dispatch, projectId]
    )

    const assignSub = useCallback(
        async (itemId, parentId) => {
            const res = await dispatch(assignToParent({ projectId, itemId, parentId }))
            if (!res.error) {
                dispatch(fetchBudgetItems({ projectId, section, page, search, groupByPage, groupByRoom }))
            }
            return res
        },
        [dispatch, projectId, section, page, search, groupByPage, groupByRoom]
    )

    return { addSub, updateSub, deleteSub, detachSub, assignSub }
}
