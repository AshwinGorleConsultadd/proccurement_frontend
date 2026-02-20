
import { useState, useEffect } from "react"
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { DeleteRowDialog } from "./DeleteRowDialog"
import { formatCurrency } from "../lib/utils"
import { Input } from "./ui/input"

/** Extract leading number from qty strings like "1 Ea.", "2.5 pcs", "3" → returns the number or 1 */
function parseQtyNumber(qty) {
    if (!qty) return 1
    const match = String(qty).match(/^[\s]*([0-9]+(?:\.[0-9]*)?)/)
    return match ? parseFloat(match[1]) : 1
}

export function BudgetRow({
    item,
    isEditing,
    onStartEdit,
    onSave,
    onCancel,
    onDelete,
    onInsert,
}) {
    const [localItem, setLocalItem] = useState({ ...item })
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    // Reset local state when item prop changes or editing mode changes
    useEffect(() => {
        setLocalItem({ ...item })
    }, [item, isEditing])

    const handleChange = (field, value) => {
        setLocalItem((prev) => {
            const updated = { ...prev, [field]: value }

            const qtyNum = parseQtyNumber(field === "qty" ? value : updated.qty)

            if (field === "unit_cost" || field === "qty") {
                // unit_cost or qty changed → recalculate extended
                const unitCost = field === "unit_cost"
                    ? parseFloat(value) || 0
                    : parseFloat(updated.unit_cost) || 0
                updated.extended = parseFloat((qtyNum * unitCost).toFixed(2))
            } else if (field === "extended") {
                // extended changed → back-calculate unit_cost = extended / qty
                const extVal = parseFloat(value) || 0
                updated.unit_cost = qtyNum > 0
                    ? parseFloat((extVal / qtyNum).toFixed(2))
                    : 0
            }

            return updated
        })
    }

    // Handle save
    const handleSave = () => {
        onSave(item.id, localItem)
    }

    // Handle enter key to save
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSave()
        } else if (e.key === "Escape") {
            onCancel()
        }
    }

    return (
        <>
            <tr className={`border-b transition-colors hover:bg-muted/50 ${isEditing ? "bg-muted/30 ring-1 ring-inset ring-muted-foreground/20" : ""}`}>
                {/* Spec No */}
                <td className="p-2 align-middle font-medium w-[100px]">
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
                </td>

                {/* Vendor */}
                <td className="p-2 align-middle w-[120px]">
                    {isEditing ? (
                        <Input
                            value={localItem.vendor || ""}
                            onChange={(e) => handleChange("vendor", e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8"
                        />
                    ) : (
                        item.vendor
                    )}
                </td>

                {/* Vendor Description */}
                <td className="p-2 align-middle hidden md:table-cell max-w-[150px] truncate">
                    {isEditing ? (
                        <Input
                            value={localItem.vendor_description || ""}
                            onChange={(e) => handleChange("vendor_description", e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8"
                        />
                    ) : (
                        item.vendor_description
                    )}
                </td>

                {/* Description */}
                <td className="p-2 align-middle max-w-[200px] truncate">
                    {isEditing ? (
                        <Input
                            value={localItem.description || ""}
                            onChange={(e) => handleChange("description", e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8"
                        />
                    ) : (
                        item.description
                    )}
                </td>

                {/* Room Name */}
                <td className="p-2 align-middle w-[120px]">
                    {isEditing ? (
                        <Input
                            value={localItem.room_name || ""}
                            onChange={(e) => handleChange("room_name", e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8"
                        />
                    ) : (
                        item.room_name
                    )}
                </td>

                {/* Page No */}
                <td className="p-2 align-middle w-[60px] text-center">
                    {isEditing ? (
                        <Input
                            type="number"
                            value={localItem.page_no || ""}
                            onChange={(e) => handleChange("page_no", parseInt(e.target.value) || "")}
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
                            onChange={(e) => handleChange("unit_cost", parseFloat(e.target.value))}
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
                            onChange={(e) => handleChange("extended", parseFloat(e.target.value))}
                            onKeyDown={handleKeyDown}
                            className="h-8 text-right"
                        />
                    ) : (
                        formatCurrency(item.extended)
                    )}
                </td>

                {/* Actions */}
                <td className="p-2 align-middle w-[120px]">
                    <div className="flex items-center gap-1 justify-end">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${isEditing ? "text-orange-500 hover:text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/20" : "text-muted-foreground"}`}
                            onClick={isEditing ? handleSave : () => onStartEdit(item.id)}
                            title={isEditing ? "Save changes" : "Edit row"}
                        >
                            {isEditing ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onInsert(item.id, "above")}>
                                    Insert Above
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onInsert(item.id, "below")}>
                                    Insert Below
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

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

            <DeleteRowDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={() => {
                    onDelete(item.id)
                    setDeleteDialogOpen(false)
                }}
                itemName={item.description || "this item"}
            />
        </>
    )
}
