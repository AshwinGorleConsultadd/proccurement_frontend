import { useState } from "react";
import { TableRow, TableCell } from "../ui/table";
import { Button } from "../ui/button";
import {
  Pencil,
  Trash2,
  Check,
  X,
  CornerDownRight,
  ArrowUpFromLine,
  EyeOff,
  Eye,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "../../lib/utils";

/**
 * SubItemRow — renders one nested sub-item inside a budget item row.
 *
 * Props:
 *   subitem       — subitem data object
 *   onUpdate      — (subId, data) => void
 *   onDelete      — (subId) => void
 *   onDetach      — (subId) => void   — promote to top-level
 *   colSpanTotal  — total number of columns in the table (for alignment)
 */
export function SubItemRow({
  subitem,
  onUpdate,
  onDelete,
  onDetach,
  colSpanTotal = 10,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detaching, setDetaching] = useState(false);

  const [draft, setDraft] = useState({
    spec_no: subitem.spec_no || "",
    description: subitem.description || "",
    qty: subitem.qty || "1 Ea.",
    unit_cost: subitem.unit_cost ?? "",
  });

  const field = (key) => ({
    value: draft[key],
    onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
    className:
      "w-full text-xs border border-input rounded px-1.5 py-1 bg-background focus:outline-none focus:border-ring",
  });

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...draft,
      unit_cost: draft.unit_cost !== "" ? Number(draft.unit_cost) : null,
    };
    await onUpdate(subitem._id, data);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(subitem._id);
    setDeleting(false);
  };

  const handleDetach = async () => {
    setDetaching(true);
    await onDetach(subitem._id);
    setDetaching(false);
  };

  const handleToggleHide = async () => {
    await onUpdate(subitem._id, {
      hidden_from_total: !subitem.hidden_from_total,
    });
  };

  const cellCls = "py-1.5 pl-2 pr-1 text-xs border-b border-border/30";
  const mutedRow = subitem.hidden_from_total ? "opacity-50" : "";

  return (
    <TableRow
      className={`bg-muted/20 hover:bg-muted/30 transition-colors ${mutedRow}`}
    >
      {/* Indent indicator */}
      <TableCell className={`${cellCls} w-[100px]`}>
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <CornerDownRight className="h-3 w-3 shrink-0" />
          {editing ? (
            <input
              {...field("spec_no")}
              placeholder="Spec No"
              style={{ width: 70 }}
            />
          ) : (
            <span className="font-mono text-[11px] text-muted-foreground">
              {subitem.spec_no || "—"}
            </span>
          )}
        </div>
      </TableCell>

      {/* Description */}
      <TableCell className={cellCls}>
        {editing ? (
          <input {...field("description")} placeholder="Description" />
        ) : (
          <span>{subitem.description}</span>
        )}
      </TableCell>

      {/* Room — empty for subitems */}
      <TableCell className={cellCls} />

      {/* Page — empty */}
      <TableCell className={cellCls} />

      {/* Qty */}
      <TableCell className={cellCls}>
        {editing ? (
          <input {...field("qty")} placeholder="Qty" style={{ width: 70 }} />
        ) : (
          <span>{subitem.qty}</span>
        )}
      </TableCell>

      {/* Unit Cost */}
      <TableCell className={`${cellCls} text-right`}>
        {editing ? (
          <input
            {...field("unit_cost")}
            placeholder="0.00"
            type="number"
            step="0.01"
            style={{ width: 80, textAlign: "right" }}
          />
        ) : (
          formatCurrency(subitem.unit_cost)
        )}
      </TableCell>

      {/* Extended */}
      <TableCell className={`${cellCls} text-right`}>
        <span
          className={
            subitem.hidden_from_total
              ? "line-through text-muted-foreground"
              : ""
          }
        >
          {formatCurrency(subitem.extended)}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className={`${cellCls} text-right`}>
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3 text-emerald-500" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-0.5">
            {/* Hide from totals */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title={
                subitem.hidden_from_total
                  ? "Show in totals"
                  : "Hide from totals"
              }
              onClick={handleToggleHide}
            >
              {subitem.hidden_from_total ? (
                <Eye className="h-3 w-3 text-muted-foreground" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
            {/* Edit */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setEditing(true)}
              title="Edit sub-item"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
            {/* Detach → promote */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleDetach}
              disabled={detaching}
              title="Promote to top-level item"
            >
              {detaching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-3 w-3 text-blue-400" />
              )}
            </Button>
            {/* Delete */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleDelete}
              disabled={deleting}
              title="Remove sub-item"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 text-destructive" />
              )}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
