
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
import { useSubItems } from "../../redux/hooks/budget/useSubItems"
import {
    setEditingRowId,
    setSearch,
    setPage,
    setGroupByPage,
    setGroupByRoom,
    setSection,
    setProjectId as setProjectIdAction,
} from "../../redux/slices/budgetSlice"

import { BudgetRow } from "./BudgetRow"
import { PaginationControls } from "./PaginationControls"
import { SearchInput } from "./SearchInput"
import { formatCurrency } from "../../lib/utils"
import { exportToExcel, exportToPdf } from "./exportBudget"

/**
 * BudgetTable — requires a projectId prop (MongoDB _id string of the project).
 */
export function BudgetTable({ projectId: propProjectId }) {
    const dispatch = useDispatch()
    const { items, total, page, pageSize, totalSubtotal, roomTotals, loading, error, refetch } = useGetBudgetItems()
    const { create } = useCreateBudgetItem()
    const { update } = useUpdateBudgetItem()
    const { remove } = useDeleteBudgetItem()
    const { addSub, updateSub, deleteSub, detachSub } = useSubItems()

    const { editingRowId, search, groupByPage, groupByRoom, section, projectId } = useSelector((state) => state.budget)
    const [exporting, setExporting] = useState(null)

    // Sync projectId from prop into Redux
    useEffect(() => {
        if (propProjectId && propProjectId !== projectId) {
            dispatch(setProjectIdAction(propProjectId))
        }
    }, [propProjectId, projectId, dispatch])

    // Handlers
    const handleStartEdit = (id) => dispatch(setEditingRowId(id))

    const handleSave = async (id, data) => {
        // Strip non-updatable fields
        const { _id, __v, section: _s, order_index: _oi, subitems: _sub, created_at: _ca, updated_at: _ua, project_id: _pid, ...updateData } = data
        await update(id, updateData)
        dispatch(setEditingRowId(null))
        refetch()
    }

    const handleCancel = () => dispatch(setEditingRowId(null))

    const handleDelete = async (id) => {
        await remove(id)
    }

    const handleInsert = async (relativeToId, position) => {
        const newItem = { section, insert_relative_to: relativeToId, position }
        const result = await create(newItem)
        if (!result.error) {
            dispatch(setEditingRowId(result.payload._id))
            refetch()
        }
    }

    const handleToggleHide = async (id) => {
        const item = items.find((i) => i._id === id)
        if (!item) return
        await update(id, { hidden_from_total: !item.hidden_from_total })
        refetch()
    }

    const handleSearchChange = (val) => dispatch(setSearch(val))
    const handlePageChange = (p) => dispatch(setPage(p))
    const toggleGroupByPage = (v) => dispatch(setGroupByPage(v))
    const toggleGroupByRoom = (v) => dispatch(setGroupByRoom(v))

    // Export
    const handleExport = async (format) => {
        if (!projectId) return
        setExporting(format)
        try {
            if (format === "excel") await exportToExcel(projectId, section, groupByRoom, groupByPage)
            else await exportToPdf(projectId, section, groupByRoom, groupByPage)
        } catch (e) {
            console.error("Export failed:", e)
        } finally {
            setExporting(null)
        }
    }

    // ── Group headers + room subtotals ────────────────────────────────────────
    const buildRows = () => {
        const rows = []
        let lastGroupKey = null
        let lastTotal = null

        items.forEach((item, idx) => {
            if (groupByPage) {
                const key = item.page_no
                if (key !== lastGroupKey) {
                    if (lastGroupKey !== null && lastTotal !== null) {
                        rows.push(
                            <TableRow key={`subtotal-page-${lastGroupKey}`} className="bg-muted/40 border-t-2 font-semibold">
                                <TableCell colSpan={9} className="py-2 pl-3 text-sm text-muted-foreground">Page {lastGroupKey} — Subtotal</TableCell>
                                <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">{formatCurrency(lastTotal)}</TableCell>
                                <TableCell />
                            </TableRow>
                        )
                    }
                    rows.push(
                        <TableRow key={`header-page-${key}`} className="bg-muted/60 hover:bg-muted/60">
                            <TableCell colSpan={11} className="py-2 pl-3">
                                <Badge variant="secondary" className="text-xs">Page {key ?? "N/A"}</Badge>
                            </TableCell>
                        </TableRow>
                    )
                    lastGroupKey = key
                    lastTotal = 0
                }
                if (!item.hidden_from_total) lastTotal += item.extended || 0
            } else if (groupByRoom) {
                const key = item.room_name || "Unassigned Room"
                if (key !== lastGroupKey) {
                    rows.push(
                        <TableRow key={`header-room-${key}`} className="bg-muted/60 hover:bg-muted/60">
                            <TableCell colSpan={11} className="py-2 pl-3">
                                <Badge variant="secondary" className="text-xs">{key}</Badge>
                            </TableCell>
                        </TableRow>
                    )
                    lastGroupKey = key
                    lastTotal = roomTotals[key] ?? null
                }
            }

            rows.push(
                <BudgetRow
                    key={item._id}
                    item={item}
                    isEditing={editingRowId === item._id}
                    onStartEdit={handleStartEdit}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onDelete={handleDelete}
                    onInsert={handleInsert}
                    onToggleHide={handleToggleHide}
                    onAddSubItem={addSub}
                    onUpdateSubItem={updateSub}
                    onDeleteSubItem={deleteSub}
                    onDetachSubItem={detachSub}
                />
            )
        })

        // Final group subtotal
        if (groupByPage && lastGroupKey !== null && lastTotal !== null) {
            rows.push(
                <TableRow key={`subtotal-page-${lastGroupKey}-last`} className="bg-muted/40 border-t-2 font-semibold">
                    <TableCell colSpan={9} className="py-2 pl-3 text-sm text-muted-foreground">Page {lastGroupKey} — Subtotal</TableCell>
                    <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">{formatCurrency(lastTotal)}</TableCell>
                    <TableCell />
                </TableRow>
            )
        }
        if (groupByRoom) {
            const uniqueRooms = [...new Set(items.map((i) => i.room_name || "Unassigned Room"))]
            uniqueRooms.forEach((room) => {
                if (roomTotals[room] != null) {
                    rows.push(
                        <TableRow key={`subtotal-room-${room}`} className="bg-primary/5 border-t-2 font-semibold">
                            <TableCell colSpan={9} className="py-2 pl-3 text-sm text-muted-foreground italic">{room} — Merchandise Total</TableCell>
                            <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">{formatCurrency(roomTotals[room])}</TableCell>
                            <TableCell />
                        </TableRow>
                    )
                }
            })
        }

        return rows
    }

    if (!propProjectId) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                No project selected. Open a project to view its budget.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Controls Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Switch id="group-page" checked={groupByPage} onCheckedChange={toggleGroupByPage} disabled={loading} />
                        <label htmlFor="group-page" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Group by Page</label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="group-room" checked={groupByRoom} onCheckedChange={toggleGroupByRoom} disabled={loading} />
                        <label htmlFor="group-room" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Group by Room</label>
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
                                variant="outline" size="sm"
                                className="gap-1.5 text-xs border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40"
                                disabled={exporting != null || loading}
                            >
                                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleExport("excel") }} className="gap-2 cursor-pointer">
                                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                                <span>Export as Excel</span>
                                {exporting === "excel" && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleExport("pdf") }} className="gap-2 cursor-pointer">
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
                                <TableCell colSpan={10} className="h-24 text-center">No budget items found.</TableCell>
                            </TableRow>
                        )}
                        {buildRows()}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={handlePageChange} />
        </div>
    )
}
