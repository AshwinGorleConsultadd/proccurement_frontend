import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import SelectedGroupCard from "./SelectedGroupCard";

export default function Sidebar({
  groups,
  masks,
  selectedGroupId,
  setSelectedGroupId,
  editorMode,
  setEditorMode,
  selectedMaskIds,
  changeGroupMode, // boolean – reassign mode toggle
  setChangeGroupMode, // (bool) => void
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup, // (groupId) => void
  onMaskClick,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  // ── Live filter — matches name OR code, case-insensitive ──────────────────
  const q = searchQuery.trim().toLowerCase();
  const allGroups = Object.values(groups);
  const filteredGroups = q
    ? allGroups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.code && g.code.toLowerCase().includes(q)),
      )
    : allGroups;

  return (
    <div className="w-72 border-r bg-white flex flex-col h-full font-sans">
      {/* ── Header & Mode Toggle ─────────────────────────────────────────────── */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          <span>Editor Mode</span>
        </div>

        <div className="flex bg-gray-100 p-1 border border-gray-200">
          <button
            onClick={() => setEditorMode("all")}
            className={cn(
              "flex-1 py-1.5 text-sm font-medium transition-all text-center",
              editorMode === "all"
                ? "bg-white text-black shadow-sm ring-1 ring-black/5"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            Show All
          </button>
          <button
            onClick={() => setEditorMode("group")}
            className={cn(
              "flex-1 py-1.5 text-sm font-medium transition-all text-center",
              editorMode === "group"
                ? "bg-white text-black shadow-sm ring-1 ring-black/5"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            Group Mode
          </button>
        </div>
      </div>

      {/* ── Selected Group Card ───────────────────────────────────────────────── */}
      {selectedGroupId && groups[selectedGroupId] && (
        <SelectedGroupCard
          group={groups[selectedGroupId]}
          masks={masks}
          selectedMaskIds={selectedMaskIds}
          onUpdate={onUpdateGroup}
          onMaskClick={onMaskClick}
          setEditorMode={setEditorMode}
        />
      )}

      {/* ── Groups List ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* ── Reassign-mode toggle (only in Group Mode) ──────────────────── */}
        {editorMode === "group" && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setChangeGroupMode((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium border transition-all",
                changeGroupMode
                  ? "bg-orange-50 border-orange-300 text-orange-700 shadow-sm"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700",
              )}
            >
              {/* Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={cn(
                  "w-3.5 h-3.5 flex-shrink-0",
                  changeGroupMode ? "text-orange-500" : "text-gray-400",
                )}
              >
                <path d="M3 3.732a1.5 1.5 0 0 1 2.305-1.265l6.706 4.267a1.5 1.5 0 0 1 0 2.531l-6.706 4.268A1.5 1.5 0 0 1 3 12.267V3.732Z" />
              </svg>
              <span>Reassign Mode</span>
              {/* Active indicator pill */}
              <span
                className={cn(
                  "ml-auto text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5",
                  changeGroupMode
                    ? "bg-orange-200 text-orange-700"
                    : "bg-gray-200 text-gray-500",
                )}
              >
                {changeGroupMode ? "ON" : "OFF"}
              </span>
            </button>

            {/* Keyboard hints when mode is active */}
            {changeGroupMode && (
              <div className="mt-1.5 px-2 py-1.5 bg-orange-50 border border-orange-100 text-[10px] text-orange-600 space-y-0.5">
                <p>
                  <kbd className="font-mono font-bold">Click</kbd> — select mask
                </p>
                <p>
                  <kbd className="font-mono font-bold">Shift+Click</kbd> —
                  multi-select / deselect
                </p>
                <p>
                  <kbd className="font-mono font-bold">Ctrl+Click</kbd> — open
                  group picker
                </p>
              </div>
            )}
          </div>
        )}

        {/* Section header row */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Groups
            </h2>
            {/* Show filtered/total count */}
            <span className="text-xs bg-gray-100 px-1.5 py-0.5 text-gray-600 border border-gray-200">
              {q
                ? `${filteredGroups.length} / ${allGroups.length}`
                : allGroups.length}
            </span>
          </div>

          {/* New Group button */}
          <button
            onClick={onCreateGroup}
            title="Create a new group"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 border border-blue-200 hover:border-blue-400 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            New Group
          </button>
        </div>

        {/* ── Search input ──────────────────────────────────────────────────── */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 px-2.5 py-1.5 focus-within:border-blue-400 focus-within:bg-white transition-colors">
            {/* Search icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                clipRule="evenodd"
              />
            </svg>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or code…"
              className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 focus:outline-none min-w-0"
            />

            {/* Clear button — only visible when there's a query */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                title="Clear search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Group rows ────────────────────────────────────────────────────── */}
        <ScrollArea className="flex-1">
          <div className="px-3 pb-4 space-y-px">
            {allGroups.length === 0 ? (
              /* No groups at all */
              <div className="py-8 text-center text-xs text-gray-400">
                No groups yet.{" "}
                <button
                  onClick={onCreateGroup}
                  className="text-blue-500 underline hover:text-blue-700"
                >
                  Create one
                </button>
              </div>
            ) : filteredGroups.length === 0 ? (
              /* Groups exist but search returned nothing */
              <div className="py-6 text-center text-xs text-gray-400 space-y-1">
                <p className="font-medium text-gray-500">No results</p>
                <p>No groups match &ldquo;{searchQuery}&rdquo;</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-blue-500 underline hover:text-blue-700"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredGroups.map((g) => {
                const count = masks.filter((m) => m.group_id === g.id).length;
                const isSelected = selectedGroupId === g.id;

                const colorStyle = g.color
                  ? {
                      backgroundColor: `rgb(${g.color[0]}, ${g.color[1]}, ${g.color[2]})`,
                    }
                  : { backgroundColor: "#ccc" };

                // ── Highlight matching text ─────────────────────────────────
                const highlight = (text) => {
                  if (!q) return text;
                  const idx = text.toLowerCase().indexOf(q);
                  if (idx === -1) return text;
                  return (
                    <>
                      {text.slice(0, idx)}
                      <mark className="bg-yellow-200 text-yellow-900 px-0">
                        {text.slice(idx, idx + q.length)}
                      </mark>
                      {text.slice(idx + q.length)}
                    </>
                  );
                };

                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      setSelectedGroupId(g.id);
                      if (editorMode === "all") setEditorMode("group");
                    }}
                    className={cn(
                      "group flex items-center justify-between p-2.5 cursor-pointer border-l-[3px] transition-all hover:bg-gray-50",
                      isSelected
                        ? "bg-blue-50/50 border-blue-500"
                        : "border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3.5 h-3.5 shadow-sm ring-1 ring-black/10 flex-shrink-0"
                        style={colorStyle}
                      />
                      <div className="flex flex-col min-w-0">
                        <span
                          className={cn(
                            "text-sm leading-tight truncate",
                            isSelected
                              ? "font-medium text-gray-900"
                              : "text-gray-600",
                          )}
                        >
                          {highlight(g.name)}
                        </span>
                        {g.code && (
                          <span className="text-[10px] font-mono text-gray-400 truncate">
                            {highlight(g.code)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Right-side actions: delete icon + mask count ────── */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Delete button — visible on row hover */}
                      <button
                        title={`Delete group "${g.name}"`}
                        onClick={(e) => {
                          e.stopPropagation(); // don't select the group
                          onDeleteGroup(g.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-3.5 h-3.5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {/* Mask count badge */}
                      <span
                        className={cn(
                          "text-xs font-medium px-1.5 py-0.5 min-w-[1.5rem] text-center",
                          isSelected
                            ? "text-blue-600 bg-blue-100"
                            : "text-gray-400 bg-gray-100 group-hover:bg-gray-200",
                        )}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Selection footer ─────────────────────────────────────────────────── */}
      {selectedMaskIds?.length > 0 && (
        <div className="p-3 border-t bg-gray-50 text-xs flex justify-between items-center">
          <span className="text-gray-500 font-medium uppercase tracking-wide">
            Selection
          </span>
          <span className="bg-white border px-2 py-1 font-mono text-gray-700 shadow-sm">
            {selectedMaskIds.length} items
          </span>
        </div>
      )}
    </div>
  );
}
