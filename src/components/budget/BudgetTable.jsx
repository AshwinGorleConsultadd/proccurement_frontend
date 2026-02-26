
import { useEffect, Fragment, useState } from "react"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Loader2, Download, FileSpreadsheet, FileText } from "lucide-react"

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
import { exportToExcel, exportToPdf } from "./exportBudget"

export function BudgetTable() {
    const dispatch = useDispatch()
    const { items, total, page, pageSize, totalSubtotal, roomTotals, loading, error, refetch } = useGetBudgetItems()
    const { create } = useCreateBudgetItem()
    const { update } = useUpdateBudgetItem()
    const { remove } = useDeleteBudgetItem()

    const { editingRowId, search, groupByPage, groupByRoom, section } = useSelector((state) => state.budget)
    const [exporting, setExporting] = useState(null) // 'excel' | 'pdf' | null

    const handleExport = async (format) => {
        setExporting(format)
        try {
            if (format === "excel") {
                await exportToExcel(section, groupByRoom, groupByPage)
            } else {
                await exportToPdf(section, groupByRoom, groupByPage)
            }
        } catch (e) {
            console.error("Export failed:", e)
        } finally {
            setExporting(null)
        }
    }

    // Handlers
    const handleStartEdit = (id) => {
        dispatch(setEditingRowId(id))
    }

    const handleSave = async (id, data) => {
        // Strip fields that aren't part of BudgetItemUpdate — only send editable fields
        const { id: _id, section: _section, order_index: _oi, ...updateData } = data
        await update(id, updateData)
        dispatch(setEditingRowId(null))
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

    const handleToggleHide = async (id, hidden) => {
        await update(id, { hidden_from_total: hidden })
        refetch()
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

    // Build rendered rows with group headers and per-room subtotal rows
    const buildRows = () => {
        const rows = []
        let prevItem = null

        items.forEach((item, index) => {
            // Emit group header if the grouping key changed
            if (groupByPage) {
                if (!prevItem || item.page_no !== prevItem.page_no) {
                    rows.push(
                        <TableRow key={`group-page-${item.page_no}-${index}`} className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={10} className="font-semibold py-2 pl-4 text-primary">
                                Page {item.page_no !== null ? item.page_no : "Unassigned"}
                            </TableCell>
                        </TableRow>
                    )
                }
            } else if (groupByRoom) {
                const currentRoom = item.room_name || "Unassigned Room"
                const prevRoom = prevItem ? (prevItem.room_name || "Unassigned Room") : null

                // Before new room group: if there was a previous room, emit its subtotal row
                if (prevItem && currentRoom !== prevRoom) {
                    const prevTotal = roomTotals[prevRoom] ?? 0
                    rows.push(
                        <TableRow
                            key={`room-subtotal-${prevRoom}-${index}`}
                            className="bg-primary/5 hover:bg-primary/5 border-t border-primary/20"
                        >
                            <TableCell colSpan={8} className="py-2 pl-4 text-sm font-medium text-muted-foreground italic">
                                {prevRoom} — Merchandise Total
                            </TableCell>
                            <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">
                                {formatCurrency(prevTotal)}
                            </TableCell>
                            <TableCell />
                        </TableRow>
                    )
                }

                // Emit room header row
                if (!prevItem || currentRoom !== prevRoom) {
                    rows.push(
                        <TableRow key={`group-room-${currentRoom}-${index}`} className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={10} className="font-semibold py-2 pl-4 text-primary">
                                {currentRoom}
                            </TableCell>
                        </TableRow>
                    )
                }
            }

            rows.push(
                <Fragment key={item.id}>
                    <BudgetRow
                        item={item}
                        isEditing={editingRowId === item.id}
                        onStartEdit={handleStartEdit}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        onDelete={handleDelete}
                        onInsert={handleInsert}
                        onToggleHide={handleToggleHide}
                    />
                </Fragment>
            )

            prevItem = item

            // After last item, if grouping by room, emit the final room's subtotal
            if (groupByRoom && index === items.length - 1) {
                const lastRoom = item.room_name || "Unassigned Room"
                const lastTotal = roomTotals[lastRoom] ?? 0
                rows.push(
                    <TableRow
                        key={`room-subtotal-${lastRoom}-end`}
                        className="bg-primary/5 hover:bg-primary/5 border-t border-primary/20"
                    >
                        <TableCell colSpan={8} className="py-2 pl-4 text-sm font-medium text-muted-foreground italic">
                            {lastRoom} — Merchandise Total
                        </TableCell>
                        <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">
                            {formatCurrency(lastTotal)}
                        </TableCell>
                        <TableCell />
                    </TableRow>
                )
            }
        })

        return rows
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
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Total Budget:</span>
                        <span className="text-xl font-bold">{formatCurrency(totalSubtotal)}</span>
                    </div>
                    <div className="h-6 w-px bg-border" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40"
                                disabled={exporting != null || loading}
                            >
                                {exporting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Download className="h-3.5 w-3.5" />
                                )}
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                                onSelect={(e) => {
                                    e.preventDefault()
                                    handleExport("excel")
                                }}
                                className="gap-2 cursor-pointer"
                            >
                                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                                <span>Export as Excel</span>
                                {exporting === "excel" && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={(e) => {
                                    e.preventDefault()
                                    handleExport("pdf")
                                }}
                                className="gap-2 cursor-pointer"
                            >
                                <FileText className="h-4 w-4 text-red-500" />
                                <span>Export as PDF</span>
                                {exporting === "pdf" && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                            <TableHead className="w-[150px] text-right">Actions</TableHead>
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

                        {buildRows()}
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
