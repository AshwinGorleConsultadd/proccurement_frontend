import { useEffect, Fragment, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Filter,
} from "lucide-react";

import { useGetBudgetItems } from "../../redux/hooks/budget/useGetBudgetItems";
import { useCreateBudgetItem } from "../../redux/hooks/budget/useCreateBudgetItem";
import { useUpdateBudgetItem } from "../../redux/hooks/budget/useUpdateBudgetItem";
import { useDeleteBudgetItem } from "../../redux/hooks/budget/useDeleteBudgetItem";
import { useSubItems } from "../../redux/hooks/budget/useSubItems";
import { useGetRooms } from "../../redux/hooks/project/useGetRooms";
import {
  setEditingRowId,
  setSearch,
  setPage,
  setRoomFilter,
  setGroupByPage,
  setGroupByRoom,
  setSection,
  setProjectId as setProjectIdAction,
} from "../../redux/slices/budgetSlice";

import { BudgetRow } from "./BudgetRow";
import { PaginationControls } from "./PaginationControls";
import { SearchInput } from "./SearchInput";
import { CreateRoomDialog } from "./CreateRoomDialog";
import { formatCurrency } from "../../lib/utils";
import { exportToExcel, exportToPdf } from "./exportBudget";

/**
 * BudgetTable — requires a projectId prop (MongoDB _id string of the project).
 */
export function BudgetTable({ projectId: propProjectId }) {
  const dispatch = useDispatch();
  const {
    items,
    total,
    page,
    pageSize,
    totalSubtotal,
    roomTotals,
    loading,
    error,
    refetch,
  } = useGetBudgetItems();
  const { create } = useCreateBudgetItem();
  const { update } = useUpdateBudgetItem();
  const { remove } = useDeleteBudgetItem();
  const { addSub, updateSub, deleteSub, detachSub, assignSub } = useSubItems();
  const { rooms, fetchRooms, createRoom } = useGetRooms(propProjectId);

  const {
    editingRowId,
    search,
    roomFilter,
    groupByPage,
    groupByRoom,
    section,
    projectId,
  } = useSelector((state) => state.budget);
  const [exporting, setExporting] = useState(null);
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = useState(false);

  // Sync projectId from prop into Redux
  useEffect(() => {
    if (propProjectId && propProjectId !== projectId) {
      dispatch(setProjectIdAction(propProjectId));
      fetchRooms();
    } else if (propProjectId) {
      fetchRooms();
    }
  }, [propProjectId, projectId, dispatch, fetchRooms]);

  // Handlers
  const handleStartEdit = (id) => dispatch(setEditingRowId(id));

  const handleSave = async (id, data) => {
    // Strip non-updatable fields
    const {
      _id,
      __v,
      section: _s,
      order_index: _oi,
      subitems: _sub,
      created_at: _ca,
      updated_at: _ua,
      project_id: _pid,
      ...updateData
    } = data;
    await update(id, updateData);
    dispatch(setEditingRowId(null));
    refetch();
  };

  const handleCancel = () => dispatch(setEditingRowId(null));

  const handleDelete = async (id) => {
    await remove(id);
  };

  const handleInsert = async (relativeToId, position) => {
    const newItem = {
      section,
      insert_relative_to: relativeToId,
      position,
      created_by: "user",
    };
    const result = await create(newItem);
    if (!result.error) {
      dispatch(setEditingRowId(result.payload._id));
      refetch();
    }
  };

  const handleCreateNew = async () => {
    const newItem = {
      spec_no: "New Item",
      description: "",
      qty: "1 Ea.",
      unit_cost: 0,
      created_by: "user",
    };
    const result = await create(newItem);
    if (!result.error) {
      dispatch(setEditingRowId(result.payload._id));
      refetch();
    }
  };

  const handleToggleHide = async (id) => {
    const item = items.find((i) => i._id === id);
    if (!item) return;
    await update(id, { hidden_from_total: !item.hidden_from_total });
    refetch();
  };

  const handleSearchChange = (val) => dispatch(setSearch(val));
  const handlePageChange = (p) => dispatch(setPage(p));

  const handleToggleRoomFilter = (roomId) => {
    let newFilter = [...(roomFilter || [])];
    if (newFilter.includes(roomId)) {
      newFilter = newFilter.filter((id) => id !== roomId);
    } else {
      newFilter.push(roomId);
    }
    dispatch(setRoomFilter(newFilter));
  };

  const toggleGroupByPage = (v) => dispatch(setGroupByPage(v));
  const toggleGroupByRoom = (v) => dispatch(setGroupByRoom(v));

  // Export
  const handleExport = async (format) => {
    if (!projectId) return;
    setExporting(format);
    try {
      if (format === "excel")
        await exportToExcel(projectId, section, groupByRoom, groupByPage);
      else await exportToPdf(projectId, section, groupByRoom, groupByPage);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(null);
    }
  };

  // ── Group headers + room subtotals ────────────────────────────────────────
  const buildRows = () => {
    const rows = [];
    let lastGroupKey = null;
    let lastTotal = null;

    items.forEach((item, idx) => {
      if (groupByPage) {
        const key = item.page_no;
        if (key !== lastGroupKey) {
          if (lastGroupKey !== null && lastTotal !== null) {
            rows.push(
              <TableRow
                key={`subtotal-page-${lastGroupKey}`}
                className="bg-muted/40 border-t-2 font-semibold"
              >
                <TableCell
                  colSpan={7}
                  className="py-2 pl-3 text-sm text-muted-foreground"
                >
                  Page {lastGroupKey} — Subtotal
                </TableCell>
                <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">
                  {formatCurrency(lastTotal)}
                </TableCell>
                <TableCell />
              </TableRow>,
            );
          }
          rows.push(
            <TableRow
              key={`header-page-${key}`}
              className="bg-muted/60 hover:bg-muted/60"
            >
              <TableCell colSpan={9} className="py-2 pl-3">
                <Badge variant="secondary" className="text-xs">
                  Page {key ?? "N/A"}
                </Badge>
              </TableCell>
            </TableRow>,
          );
          lastGroupKey = key;
          lastTotal = 0;
        }
        if (!item.hidden_from_total) lastTotal += item.extended || 0;
      } else if (groupByRoom) {
        const roomObj = rooms.find((r) => r._id === item.room);
        const key = roomObj ? roomObj.name : item.room || "Unassigned Room";
        if (key !== lastGroupKey) {
          rows.push(
            <TableRow
              key={`header-room-${key}`}
              className="bg-muted/60 hover:bg-muted/60"
            >
              <TableCell colSpan={9} className="py-2 pl-3">
                <Badge variant="secondary" className="text-xs">
                  {key}
                </Badge>
              </TableCell>
            </TableRow>,
          );
          lastGroupKey = key;
          lastTotal = roomTotals[key] ?? null;
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
          onAssignSubItem={assignSub}
          rootItems={items}
          rooms={rooms}
        />,
      );
    });

    // Final group subtotal
    if (groupByPage && lastGroupKey !== null && lastTotal !== null) {
      rows.push(
        <TableRow
          key={`subtotal-page-${lastGroupKey}-last`}
          className="bg-muted/40 border-t-2 font-semibold"
        >
          <TableCell
            colSpan={7}
            className="py-2 pl-3 text-sm text-muted-foreground"
          >
            Page {lastGroupKey} — Subtotal
          </TableCell>
          <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">
            {formatCurrency(lastTotal)}
          </TableCell>
          <TableCell />
        </TableRow>,
      );
    }
    if (groupByRoom) {
      const uniqueRooms = [
        ...new Set(items.map((i) => i.room || "Unassigned Room")),
      ];
      uniqueRooms.forEach((room) => {
        if (roomTotals[room] != null) {
          rows.push(
            <TableRow
              key={`subtotal-room-${room}`}
              className="bg-primary/5 border-t-2 font-semibold"
            >
              <TableCell
                colSpan={7}
                className="py-2 pl-3 text-sm text-muted-foreground italic"
              >
                {room} — Merchandise Total
              </TableCell>
              <TableCell className="py-2 pr-3 text-right font-bold text-primary text-sm">
                {formatCurrency(roomTotals[room])}
              </TableCell>
              <TableCell />
            </TableRow>,
          );
        }
      });
    }

    return rows;
  };

  if (!propProjectId) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        No project selected. Open a project to view its budget.
      </div>
    );
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
            <label
              htmlFor="group-page"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
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
            <label
              htmlFor="group-room"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Group by Room
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total Budget:
            </span>
            <span className="text-xl font-bold">
              {formatCurrency(totalSubtotal)}
            </span>
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
                  e.preventDefault();
                  handleExport("excel");
                }}
                className="gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                <span>Export as Excel</span>
                {exporting === "excel" && (
                  <Loader2 className="h-3 w-3 ml-auto animate-spin" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleExport("pdf");
                }}
                className="gap-2 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-red-500" />
                <span>Export as PDF</span>
                {exporting === "pdf" && (
                  <Loader2 className="h-3 w-3 ml-auto animate-spin" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by Spec No..."
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter Rooms
                {roomFilter?.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1 py-0 h-4 text-[10px] min-w-4 flex items-center justify-center rounded-full"
                  >
                    {roomFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {rooms.map((room) => (
                <DropdownMenuCheckboxItem
                  key={room._id}
                  checked={(roomFilter || []).includes(room._id)}
                  onCheckedChange={() => handleToggleRoomFilter(room._id)}
                >
                  {room.name || "Unnamed Room"}
                </DropdownMenuCheckboxItem>
              ))}
              {rooms.length === 0 && (
                <div className="px-2 py-2 text-sm text-muted-foreground italic">
                  No rooms available
                </div>
              )}
              <DropdownMenuSeparator />
              <button
                className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-primary font-medium focus:bg-accent"
                onClick={() => setCreateRoomDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Room...
              </button>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleCreateNew}
            size="sm"
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Spec No</TableHead>
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
                <TableCell colSpan={8} className="h-24 text-center">
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
      {/* Modals & Dialogs */}
      <CreateRoomDialog
        open={createRoomDialogOpen}
        onOpenChange={setCreateRoomDialogOpen}
        onCreateRoom={createRoom}
      />
    </div>
  );
}
