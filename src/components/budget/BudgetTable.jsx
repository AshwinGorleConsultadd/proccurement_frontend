
import { useEffect, Fragment } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../ui/table"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Badge } from "../ui/badge"
import { Loader2 } from "lucide-react"

import { useGetBudgetItems } from "../../redux/hooks/budget/useGetBudgetItems"
import { useCreateBudgetItem } from "../../redux/hooks/budget/useCreateBudgetItem"
import { useUpdateBudgetItem } from "../../redux/hooks/budget/useUpdateBudgetItem"
import { useDeleteBudgetItem } from "../../redux/hooks/budget/useDeleteBudgetItem"
import {
    setEditingRowId,
    setSearch,
    setPage,
    setGroupByPage,
    setGroupByRoom,
    setSection,
} from "../../redux/slices/budgetSlice"

import { BudgetRow } from "./BudgetRow"
import { PaginationControls } from "./PaginationControls"
import { SearchInput } from "./SearchInput"
import { formatCurrency } from "../../lib/utils"

export function BudgetTable() {
    const dispatch = useDispatch()
    const { items, total, page, pageSize, totalSubtotal, loading, error, refetch } = useGetBudgetItems()
    const { create } = useCreateBudgetItem()
    const { update } = useUpdateBudgetItem()
    const { remove } = useDeleteBudgetItem()

    const { editingRowId, search, groupByPage, groupByRoom, section } = useSelector((state) => state.budget)

    // Handlers
    const handleStartEdit = (id) => {
        dispatch(setEditingRowId(id))
    }

    const handleSave = async (id, data) => {
        // Strip fields that aren't part of BudgetItemUpdate — only send editable fields
        const { id: _id, section: _section, order_index: _oi, ...updateData } = data
        await update(id, updateData)
        dispatch(setEditingRowId(null))
        // Re-fetch so updated values are reflected (the extraReducer updates in place
        // but re-fetching guarantees consistency with backend state)
        refetch()
    }

    const handleCancel = () => {
        dispatch(setEditingRowId(null))
    }

    const handleDelete = async (id) => {
        await remove(id)
    }

    const handleInsert = async (relativeToId, position) => {
        const newItem = {
            section,
            insert_relative_to: relativeToId,
            position
        }
        const result = await create(newItem)
        if (!result.error) {
            dispatch(setEditingRowId(result.payload.id))
            refetch()
        }
    }

    const handleSearchChange = (val) => {
        dispatch(setSearch(val))
    }

    const handlePageChange = (newPage) => {
        dispatch(setPage(newPage))
    }

    const toggleGroupByPage = (checked) => {
        dispatch(setGroupByPage(checked))
    }

    const toggleGroupByRoom = (checked) => {
        dispatch(setGroupByRoom(checked))
    }

    // Group Header Rendering Helper
    const renderGroupHeader = (item, prevItem) => {
        if (groupByPage) {
            if (!prevItem || item.page_no !== prevItem.page_no) {
                return (
                    <TableRow className="bg-muted/80 hover:bg-muted/80">
                        <TableCell colSpan={10} className="font-bold py-1">
                            Page {item.page_no || "Unassigned"}
                        </TableCell>
                    </TableRow>
                )
            }
        }
        if (groupByRoom) {
            if (!prevItem || item.room_name !== prevItem.room_name) {
                return (
                    <TableRow className="bg-muted/80 hover:bg-muted/80">
                        <TableCell colSpan={10} className="font-bold py-1">
                            {item.room_name || "Unassigned Room"}
                        </TableCell>
                    </TableRow>
                )
            }
        }
        return null
    }

    return (
        <div className="space-y-4">
            {/* Controls Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="group-page"
                            checked={groupByPage}
                            onCheckedChange={toggleGroupByPage}
                            disabled={loading}
                        />
                        <label htmlFor="group-page" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Group by Page
                        </label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="group-room"
                            checked={groupByRoom}
                            onCheckedChange={toggleGroupByRoom}
                            disabled={loading}
                        />
                        <label htmlFor="group-room" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Group by Room
                        </label>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Total Budget:</span>
                    <span className="text-xl font-bold">{formatCurrency(totalSubtotal)}</span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <SearchInput value={search} onChange={handleSearchChange} placeholder="Search by Spec No..." />
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Spec No</TableHead>
                            <TableHead className="w-[120px]">Vendor</TableHead>
                            <TableHead className="hidden md:table-cell">Vendor Desc</TableHead>
                            <TableHead className="max-w-[200px]">Description</TableHead>
                            <TableHead className="w-[120px]">Room</TableHead>
                            <TableHead className="w-[60px] text-center">Page</TableHead>
                            <TableHead className="w-[80px]">Qty</TableHead>
                            <TableHead className="w-[100px] text-right">Unit Cost</TableHead>
                            <TableHead className="w-[100px] text-right">Extended</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    No budget items found.
                                </TableCell>
                            </TableRow>
                        )}

                        {items.map((item, index) => {
                            const prevItem = index > 0 ? items[index - 1] : null
                            let groupHeader = null

                            if (groupByPage) {
                                if (!prevItem || item.page_no !== prevItem.page_no) {
                                    groupHeader = (
                                        <TableRow key={`group-page-${item.page_no}-${index}`} className="bg-muted/50 hover:bg-muted/50">
                                            <TableCell colSpan={10} className="font-semibold py-2 pl-4 text-primary">
                                                Page {item.page_no !== null ? item.page_no : "Unassigned"}
                                            </TableCell>
                                        </TableRow>
                                    )
                                }
                            } else if (groupByRoom) {
                                if (!prevItem || item.room_name !== prevItem.room_name) {
                                    groupHeader = (
                                        <TableRow key={`group-room-${item.room_name}-${index}`} className="bg-muted/50 hover:bg-muted/50">
                                            <TableCell colSpan={10} className="font-semibold py-2 pl-4 text-primary">
                                                {item.room_name || "Unassigned Room"}
                                            </TableCell>
                                        </TableRow>
                                    )
                                }
                            }

                            return (
                                <Fragment key={item.id}>
                                    {groupHeader}
                                    <BudgetRow
                                        item={item}
                                        isEditing={editingRowId === item.id}
                                        onStartEdit={handleStartEdit}
                                        onSave={handleSave}
                                        onCancel={handleCancel}
                                        onDelete={handleDelete}
                                        onInsert={handleInsert}
                                    />
                                </Fragment>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <PaginationControls
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={handlePageChange}
            />
        </div>
    )
}
