import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Hex → [R,G,B] helper ────────────────────────────────────────────────────
function hexToRgb(hex) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// ─── Preset colour swatches ───────────────────────────────────────────────────
const PRESETS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
  "#0ea5e9",
  "#a855f7",
  "#10b981",
];

export default function CreateGroupDialog({ open, onClose, onGroupCreated }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [type, setType] = useState("FF&E");
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setCode("");
    setColor("#3b82f6");
    setType("FF&E");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    if (!code.trim()) {
      setError("Group code is required.");
      return;
    }

    const id = `group_${Date.now()}`;
    onGroupCreated({
      id,
      name: name.trim(),
      code: code.trim(),
      color: hexToRgb(color),
      type,
    });

    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-none border border-gray-200 shadow-xl">
        {/* ── Header ──────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-base font-semibold text-gray-900 tracking-tight">
            Create New Group
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            Define a name, code, and colour for the new group.
          </p>
        </DialogHeader>

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Group Name
            </Label>
            <Input
              placeholder="e.g. Foundation"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              className="rounded-none h-9 text-sm focus-visible:ring-1 focus-visible:ring-blue-500"
            />
          </div>

          {/* Code */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Group Code
            </Label>
            <Input
              placeholder="e.g. FND-01"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              className="rounded-none h-9 text-sm font-mono focus-visible:ring-1 focus-visible:ring-blue-500"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Group Type
            </Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded-none cursor-pointer"
            >
              <option value="FF&E">FF&E</option>
              <option value="OFCI">OFCI</option>
            </select>
          </div>

          {/* Colour picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Group Colour
            </Label>

            {/* Preset swatches */}
            <div className="grid grid-cols-6 gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setColor(preset)}
                  title={preset}
                  className="w-full aspect-square transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: preset,
                    outline:
                      color === preset
                        ? "2px solid #1d4ed8"
                        : "2px solid transparent",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>

            {/* Native colour input + hex preview */}
            <div className="flex items-center gap-3 mt-1">
              <div
                className="w-9 h-9 border border-gray-200 shadow-inner flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="relative flex-1">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center gap-2 border border-gray-200 px-3 h-9 text-sm font-mono text-gray-700 select-none cursor-pointer">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {color.toUpperCase()}
                  <span className="ml-auto text-xs text-gray-400">
                    Click to pick
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t border-gray-100 flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="rounded-none text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            className="rounded-none text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
