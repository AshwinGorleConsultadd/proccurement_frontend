import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function AssignDrawnMaskDialog({
  open,
  onClose,
  onAssign,
  groups,
}) {
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = Object.values(groups);
    if (!q) return all;
    return all.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.code && g.code.toLowerCase().includes(q)),
    );
  }, [search, groups]);

  const handleAssign = () => {
    if (selectedGroupId) {
      onAssign(selectedGroupId);
    }
  };

  const reset = () => {
    setSearch("");
    setSelectedGroupId(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-none border border-gray-200 shadow-xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-base font-semibold text-gray-900 tracking-tight">
            Assign Mask to Group
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            Select a group for the new mask you just drew.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <Input
            placeholder="Search group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-none h-9 text-sm focus-visible:ring-1 focus-visible:ring-blue-500"
          />

          <ScrollArea className="h-48 border rounded-sm border-gray-200">
            <div className="p-1 space-y-1">
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  No groups found
                </div>
              ) : (
                filteredGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 text-left text-xs transition-colors rounded-sm",
                      selectedGroupId === g.id
                        ? "bg-blue-100 text-blue-900 font-medium"
                        : "hover:bg-gray-100 text-gray-700",
                    )}
                  >
                    <div
                      className="w-3 h-3 flex-shrink-0 shadow-sm border border-black/10"
                      style={{
                        backgroundColor: `rgb(${g.color[0]}, ${g.color[1]}, ${g.color[2]})`,
                      }}
                    />
                    <span className="truncate">
                      {g.name} {g.code ? `(${g.code})` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100 flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-none text-xs"
          >
            Skip / Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              handleAssign();
              reset();
            }}
            disabled={!selectedGroupId}
            className="rounded-none text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            Assign and Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
