import { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Layers,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DeleteRowDialog } from "./DeleteRowDialog";
import { SubItemRow } from "./SubItemRow";
import { AssignParentDialog } from "./AssignParentDialog";
import { formatCurrency } from "../../lib/utils";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

/** Extract leading number from qty strings like "1 Ea.", "2.5 pcs", "3" */
function parseQtyNumber(qty) {
  if (!qty) return 1;
  const match = String(qty).match(/^[\s]*([0-9]+(?:\.[0-9]*)?)/);
  return match ? parseFloat(match[1]) : 1;
}

export function BudgetRow({
  item,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onInsert,
  onToggleHide,
  onAddSubItem,
  onUpdateSubItem,
  onDeleteSubItem,
  onDetachSubItem,
  onAssignSubItem,
  rootItems = [],
  rooms = [],
}) {
  const [localItem, setLocalItem] = useState({ ...item });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [subExpanded, setSubExpanded] = useState(false);
  const [addingSubItem, setAddingSubItem] = useState(false);
  const [newSub, setNewSub] = useState({
    spec_no: "",
    description: "",
    qty: "1 Ea.",
    unit_cost: "",
  });

  const subitems = item.subitems || [];
  const hasSubitems = subitems.length > 0;

  // Reset local state when item prop changes or editing mode changes
  useEffect(() => {
    setLocalItem({ ...item });
  }, [item, isEditing]);

  // Auto-expand when subitems exist
  useEffect(() => {
    if (hasSubitems) setSubExpanded(true);
  }, [hasSubitems]);

  const handleChange = (field, value) => {
    setLocalItem((prev) => {
      const updated = { ...prev, [field]: value };
      const qtyNum = parseQtyNumber(field === "qty" ? value : updated.qty);
      if (field === "unit_cost" || field === "qty") {
        const unitCost =
          field === "unit_cost"
            ? parseFloat(value) || 0
            : parseFloat(updated.unit_cost) || 0;
        updated.extended = parseFloat((qtyNum * unitCost).toFixed(2));
      } else if (field === "extended") {
        const extVal = parseFloat(value) || 0;
        updated.unit_cost =
          qtyNum > 0 ? parseFloat((extVal / qtyNum).toFixed(2)) : 0;
      }
      return updated;
    });
  };

  const handleSave = () => {
    onSave(item._id, localItem);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  const handleAddSubItemSave = async () => {
    if (!newSub.description && !newSub.spec_no) return;
    await onAddSubItem(item._id, {
      ...newSub,
      unit_cost: newSub.unit_cost !== "" ? Number(newSub.unit_cost) : null,
      created_by: "user",
    });
    setNewSub({ spec_no: "", description: "", qty: "1 Ea.", unit_cost: "" });
    setAddingSubItem(false);
    setSubExpanded(true);
  };

  const isHidden = item.hidden_from_total;

  return (
    <>
      {/* ── Main item row ── */}
      <tr
        className={`border-b transition-colors hover:bg-muted/50 ${isEditing ? "bg-muted/30 ring-1 ring-inset ring-muted-foreground/20" : ""} ${isHidden ? "opacity-60" : ""}`}
      >
        {/* Spec No — with sub-item expand toggle */}
        <td className="p-2 align-middle font-medium w-[100px]">
          <div className="flex items-center gap-1">
            {hasSubitems ? (
              <button
                onClick={() => setSubExpanded((s) => !s)}
                className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={subExpanded ? "Collapse subitems" : "Expand subitems"}
              >
                {subExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            {isEditing ? (
              <Input
                value={localItem.spec_no || ""}
                onChange={(e) => handleChange("spec_no", e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8"
              />
            ) : (
              item.spec_no
            )}
          </div>
        </td>

        {/* Description */}
        <td
          className="p-2 align-middle max-w-[200px] truncate"
          title={item.description}
        >
          {isEditing ? (
            <Input
              value={localItem.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="truncate block" style={{ maxWidth: "85%" }}>
                {item.description}
              </span>
              {item.created_by === "system" && (
                <Badge
                  variant="outline"
                  className="border-violet-500/50 text-violet-500 bg-violet-500/10 px-1 py-0 h-4 text-[9px] rounded-sm shrink-0"
                >
                  AI
                </Badge>
              )}
            </div>
          )}
        </td>

        {/* Room */}
        <td className="p-2 align-middle w-[120px]">
          {isEditing ? (
            <select
              value={localItem.room || ""}
              onChange={(e) => handleChange("room", e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Room</option>
              {rooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name || r._id}
                </option>
              ))}
            </select>
          ) : (
            rooms.find((r) => r._id === item.room)?.name || item.room
          )}
        </td>

        {/* Page No */}
        <td className="p-2 align-middle w-[60px] text-center">
          {isEditing ? (
            <Input
              type="number"
              value={localItem.page_no || ""}
              onChange={(e) =>
                handleChange("page_no", parseInt(e.target.value) || "")
              }
              onKeyDown={handleKeyDown}
              className="h-8 text-center"
            />
          ) : (
            item.page_no
          )}
        </td>

        {/* Qty */}
        <td className="p-2 align-middle w-[80px]">
          {isEditing ? (
            <Input
              value={localItem.qty || ""}
              onChange={(e) => handleChange("qty", e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />
          ) : (
            item.qty
          )}
        </td>

        {/* Unit Cost */}
        <td className="p-2 align-middle w-[100px] text-right">
          {isEditing ? (
            <Input
              type="number"
              value={localItem.unit_cost || ""}
              onChange={(e) =>
                handleChange("unit_cost", parseFloat(e.target.value))
              }
              onKeyDown={handleKeyDown}
              className="h-8 text-right"
            />
          ) : (
            formatCurrency(item.unit_cost)
          )}
        </td>

        {/* Extended */}
        <td className="p-2 align-middle w-[100px] text-right font-medium">
          {isEditing ? (
            <Input
              type="number"
              value={localItem.extended || ""}
              onChange={(e) =>
                handleChange("extended", parseFloat(e.target.value))
              }
              onKeyDown={handleKeyDown}
              className="h-8 text-right"
            />
          ) : (
            <span
              className={isHidden ? "line-through text-muted-foreground" : ""}
            >
              {formatCurrency(item.extended)}
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="p-2 align-middle w-[150px]">
          <div className="flex items-center gap-0.5 justify-end">
            {/* Edit/Save toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={isEditing ? handleSave : () => onStartEdit(item._id)}
              title={isEditing ? "Save changes" : "Edit row"}
            >
              {isEditing ? (
                <EyeOff className="h-4 w-4 text-orange-500" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            {/* Hide from totals */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onToggleHide(item._id)}
              title={isHidden ? "Show in totals" : "Hide from totals"}
            >
              {isHidden ? (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            {/* Insert / Add subitem */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onInsert(item._id, "above")}>
                  Insert Row Above
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onInsert(item._id, "below")}>
                  Insert Row Below
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setAddingSubItem(true);
                    setSubExpanded(true);
                  }}
                >
                  <Layers className="h-4 w-4 mr-2 text-violet-400" />
                  Add Sub-Item
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setAssignDialogOpen(true)}>
                  Assign to Parent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {/* ── Sub-items ── */}
      {subExpanded &&
        subitems.map((sub) => (
          <SubItemRow
            key={sub._id}
            subitem={sub}
            onUpdate={(subId, data) => onUpdateSubItem(item._id, subId, data)}
            onDelete={(subId) => onDeleteSubItem(item._id, subId)}
            onDetach={(subId) => onDetachSubItem(item._id, subId)}
          />
        ))}

      {/* ── Add subitem inline form ── */}
      {addingSubItem && (
        <tr className="bg-violet-500/5 border-b border-violet-500/20">
          <td className="p-2 align-middle" colSpan={2}>
            <div className="flex items-center gap-1 pl-6">
              <span className="text-xs text-muted-foreground mr-1">
                Sub-item:
              </span>
              <Input
                placeholder="Spec No"
                value={newSub.spec_no}
                onChange={(e) =>
                  setNewSub((s) => ({ ...s, spec_no: e.target.value }))
                }
                className="h-7 text-xs w-24"
              />
              <Input
                placeholder="Description"
                value={newSub.description}
                onChange={(e) =>
                  setNewSub((s) => ({ ...s, description: e.target.value }))
                }
                className="h-7 text-xs flex-1"
              />
            </div>
          </td>
          <td className="p-2 align-middle" colSpan={3}>
            <div className="flex gap-1">
              <Input
                placeholder="Qty"
                value={newSub.qty}
                onChange={(e) =>
                  setNewSub((s) => ({ ...s, qty: e.target.value }))
                }
                className="h-7 text-xs w-20"
              />
              <Input
                placeholder="Unit $"
                type="number"
                value={newSub.unit_cost}
                onChange={(e) =>
                  setNewSub((s) => ({ ...s, unit_cost: e.target.value }))
                }
                className="h-7 text-xs w-24"
              />
            </div>
          </td>
          <td className="p-2 align-middle" colSpan={3}>
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                className="h-7 text-xs bg-violet-500 hover:bg-violet-600 text-white"
                onClick={handleAddSubItemSave}
              >
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setAddingSubItem(false)}
              >
                Cancel
              </Button>
            </div>
          </td>
        </tr>
      )}

      <DeleteRowDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          onDelete(item._id);
          setDeleteDialogOpen(false);
        }}
        itemName={item.description || "this item"}
      />

      <AssignParentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onConfirm={async (parentId) => {
          if (onAssignSubItem) {
            await onAssignSubItem(item._id, parentId);
          }
        }}
        itemName={item.description || item.spec_no || "this item"}
        rootItems={rootItems}
        itemId={item._id}
      />
    </>
  );
}
