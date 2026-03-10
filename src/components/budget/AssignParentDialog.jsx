import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

export function AssignParentDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  rootItems,
  itemId,
}) {
  const [selectedParent, setSelectedParent] = useState("");

  const handleConfirm = () => {
    if (!selectedParent) return;
    onConfirm(selectedParent);
    onOpenChange(false);
    setSelectedParent("");
  };

  const availableParents = rootItems?.filter((i) => i._id !== itemId) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign as Sub-item</DialogTitle>
          <DialogDescription>
            Select a target parent for "{itemName}". The item will become a
            sub-item of the selected root item.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <select
            value={selectedParent}
            onChange={(e) => setSelectedParent(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select Parent Item...</option>
            {availableParents.map((parent) => (
              <option key={parent._id} value={parent._id}>
                {parent.spec_no}{" "}
                {parent.description ? ` - ${parent.description}` : ""}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedParent}
            className="bg-primary hover:bg-primary/90"
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
