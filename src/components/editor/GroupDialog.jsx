import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function GroupDialog({
  open,
  onClose,
  groups,
  setGroups,
  assignGroup,
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const handleCreate = () => {
    const id = `group_${Date.now()}`;

    setGroups((prev) => ({
      ...prev,
      [id]: {
        id,
        name,
        code,
        color: hexToRgb(color),
      },
    }));

    assignGroup(id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change / Create Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <h3 className="font-semibold">Assign Existing</h3>
          {Object.values(groups).map((g) => (
            <Button
              key={g.id}
              variant="outline"
              className="w-full"
              onClick={() => {
                assignGroup(g.id);
                onClose();
              }}
            >
              {g.name}
            </Button>
          ))}

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Create New Group</h3>
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-2"
            />
            <input
              type="color"
              className="mt-2 w-full h-10"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />

            <Button className="mt-3 w-full" onClick={handleCreate}>
              Create & Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  return [
    (bigint >> 16) & 255,
    (bigint >> 8) & 255,
    bigint & 255,
  ];
}
