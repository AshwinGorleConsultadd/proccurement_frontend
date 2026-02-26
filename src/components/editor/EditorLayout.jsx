import { useState, useEffect } from "react";
import editorData from "../../data/editor_data.json";
import CanvasEditor from "./CanvasEditor";
import Sidebar from "./Sidebar";
import ContextMenu from "./ContextMenu";
import GroupDialog from "./GroupDialog";
import CreateGroupDialog from "./CreateGroupDialog";
import GroupAssignPopover from "./GroupAssignPopover";
import AssignDrawnMaskDialog from "./AssignDrawnMaskDialog";

export default function EditorLayout() {
  // ─── Core state ────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem("editor_groups");
    const baseGroups = saved ? JSON.parse(saved) : editorData.groups;

    const initializedGroups = {};
    for (const [key, group] of Object.entries(baseGroups)) {
      initializedGroups[key] = {
        ...group,
        type: group.type || "FF&E",
      };
    }
    return initializedGroups;
  });

  const [masks, setMasks] = useState(() => {
    const saved = localStorage.getItem("editor_masks");
    return saved ? JSON.parse(saved) : editorData.masks;
  });
  const [selectedMaskIds, setSelectedMaskIds] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [editorMode, setEditorMode] = useState("all");

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);

  // ─── Reassign-mode state ───────────────────────────────────────────────────
  /** Whether "Change Group" mode is active (only meaningful in group editorMode) */
  const [changeGroupMode, setChangeGroupMode] = useState(false);
  /** Position + data for the floating group-assign popover; null = hidden */
  const [assignPopover, setAssignPopover] = useState(null); // { x, y }

  // ─── Drawing mode state ────────────────────────────────────────────────────
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [pendingMaskPolygons, setPendingMaskPolygons] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saved'

  // ─── Undo / Redo ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState([{ masks, groups }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushToHistory = (newMasks, newGroups) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      masks: JSON.parse(JSON.stringify(newMasks)),
      groups: JSON.parse(JSON.stringify(newGroups)),
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex === 0) return;
    const prev = history[historyIndex - 1];
    setMasks(prev.masks);
    setGroups(prev.groups);
    setHistoryIndex(historyIndex - 1);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setMasks(next.masks);
    setGroups(next.groups);
    setHistoryIndex(historyIndex + 1);
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (ctrlKey && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Cmd+S / Ctrl+S to save to local storage
      if (ctrlKey && e.key === "s") {
        e.preventDefault();
        localStorage.setItem("editor_groups", JSON.stringify(groups));
        localStorage.setItem("editor_masks", JSON.stringify(masks));
        console.log("State saved to local storage");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedMaskIds.length > 0
      ) {
        e.preventDefault();
        deleteSelectedMasks();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyIndex, history, selectedMaskIds, groups, masks]);

  // ─── Selection helpers ────────────────────────────────────────────────────
  /**
   * Standard toggle — used by both normal mode and reassign mode.
   * isShift=true  → add / remove from selection
   * isShift=false → select only this mask
   */
  const toggleMaskSelection = (id, isShift) => {
    if (isShift) {
      setSelectedMaskIds((prev) =>
        prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
      );
    } else {
      setSelectedMaskIds([id]);
    }
  };

  /**
   * Called by CanvasEditor on Ctrl+Click in reassign mode.
   * Adds the clicked mask to selection (if not already there) and shows popover.
   */
  const handleCtrlClickMask = (maskId, cursorPos) => {
    setSelectedMaskIds((prev) =>
      prev.includes(maskId) ? prev : [...prev, maskId],
    );
    setAssignPopover(cursorPos); // { x, y }
  };

  /**
   * Called when the user clicks a group in the GroupAssignPopover.
   * Moves all selected masks to the chosen group, clears selection, saves history.
   */
  const assignMasksToGroup = (groupId) => {
    const newMasks = masks.map((mask) =>
      selectedMaskIds.includes(mask.id) ? { ...mask, group_id: groupId } : mask,
    );
    setMasks(newMasks);
    setSelectedMaskIds([]);
    setAssignPopover(null);
    pushToHistory(newMasks, groups);
  };

  // ─── Other handlers ───────────────────────────────────────────────────────
  const handleSaveNewMask = (polygons) => {
    setPendingMaskPolygons(polygons); // Pause to assign group
  };

  const handleAssignDrawnMask = (groupId) => {
    if (!pendingMaskPolygons) return;
    const newMask = {
      id: `mask_${Date.now()}`,
      group_id: groupId,
      polygons: pendingMaskPolygons,
      source: "user",
    };
    const newMasks = [...masks, newMask];
    setMasks(newMasks);
    setSelectedGroupId(groupId); // auto-select the group we just assigned to
    pushToHistory(newMasks, groups);
    setPendingMaskPolygons(null);
    setIsDrawMode(false);
  };

  /** Legacy right-click → GroupDialog path (kept for backward compat) */
  const assignGroup = (groupId) => {
    const newMasks = masks.map((mask) =>
      selectedMaskIds.includes(mask.id) ? { ...mask, group_id: groupId } : mask,
    );
    setMasks(newMasks);
    pushToHistory(newMasks, groups);
  };

  const deleteSelectedMasks = () => {
    const newMasks = masks.filter((m) => !selectedMaskIds.includes(m.id));
    setMasks(newMasks);
    setSelectedMaskIds([]);
    pushToHistory(newMasks, groups);
  };

  const handleGroupCreated = (newGroup) => {
    const newGroups = { ...groups, [newGroup.id]: newGroup };
    setGroups(newGroups);
    setSelectedGroupId(newGroup.id);
    setEditorMode("group");
    pushToHistory(masks, newGroups);
  };

  const handleGroupUpdated = (updatedGroup) => {
    const newGroups = { ...groups, [updatedGroup.id]: updatedGroup };
    setGroups(newGroups);
    pushToHistory(masks, newGroups);
  };

  /**
   * Delete a group:
   *  • Remove it from the groups map
   *  • Unassign all masks that belonged to it (group_id → null)
   *  • Clear selectedGroupId if it was the deleted group
   *  • Push to undo/redo history
   */
  const handleDeleteGroup = (groupId) => {
    const { [groupId]: _removed, ...newGroups } = groups;
    const newMasks = masks.map((m) =>
      m.group_id === groupId ? { ...m, group_id: null } : m,
    );
    setGroups(newGroups);
    setMasks(newMasks);
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    pushToHistory(newMasks, newGroups);
  };

  const handleMaskClickFromSidebar = (maskId) => {
    setSelectedMaskIds([maskId]);
    setEditorMode("group");
  };

  /** Turn off changeGroupMode when leaving group editorMode */
  const handleSetEditorMode = (mode) => {
    setEditorMode(mode);
    if (mode !== "group") setChangeGroupMode(false);
  };

  return (
    <div className="flex h-screen relative">
      <Sidebar
        groups={groups}
        masks={masks}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        editorMode={editorMode}
        setEditorMode={handleSetEditorMode}
        selectedMaskIds={selectedMaskIds}
        changeGroupMode={changeGroupMode}
        setChangeGroupMode={setChangeGroupMode}
        onCreateGroup={() => setCreateGroupDialogOpen(true)}
        onUpdateGroup={handleGroupUpdated}
        onDeleteGroup={handleDeleteGroup}
        onMaskClick={handleMaskClickFromSidebar}
      />

      <div
        className="flex-1 overflow-hidden relative"
        style={{
          backgroundColor: "#f0f0f0",
          backgroundImage:
            "radial-gradient(circle, #b0b0b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
          <button
            onClick={() => setIsDrawMode(!isDrawMode)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded shadow-sm border pointer-events-auto transition-colors ${
              isDrawMode
                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {isDrawMode ? "Cancel Drawing" : "Draw Mask"}
          </button>

          {isDrawMode && (
            <div className="text-xs text-gray-600 bg-white/95 p-2.5 rounded shadow-sm border border-gray-200 pointer-events-auto">
              <p className="font-medium text-gray-800 mb-1">Drawing Actions:</p>
              <ul className="list-disc leading-snug space-y-0.5 ml-4">
                <li>
                  <strong>Click</strong> to place points.
                </li>
                <li>
                  Press <strong>Enter</strong> to finish mask.
                </li>
                <li>
                  Press <strong>Esc</strong> to cancel.
                </li>
              </ul>
            </div>
          )}
        </div>

        <CanvasEditor
          groups={groups}
          masks={masks}
          selectedMaskIds={selectedMaskIds}
          selectedGroupId={selectedGroupId}
          editorMode={editorMode}
          changeGroupMode={changeGroupMode}
          toggleMaskSelection={toggleMaskSelection}
          setSelectedMaskIds={setSelectedMaskIds}
          setSelectedGroupId={setSelectedGroupId}
          setContextMenu={setContextMenu}
          onCtrlClickMask={handleCtrlClickMask}
          isDrawMode={isDrawMode}
          onSaveNewMask={handleSaveNewMask}
        />
      </div>

      {/* ── Right-click context menu (legacy path) ─────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onAssign={() => {
            setGroupDialogOpen(true);
            setContextMenu(null);
          }}
          onDelete={() => {
            deleteSelectedMasks();
            setContextMenu(null);
          }}
        />
      )}

      {/* ── Floating group-assign popover ─────────────────────────────────── */}
      {assignPopover && (
        <GroupAssignPopover
          position={assignPopover}
          groups={groups}
          selectedCount={selectedMaskIds.length}
          onAssign={assignMasksToGroup}
          onClose={() => setAssignPopover(null)}
        />
      )}

      <GroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        groups={groups}
        setGroups={setGroups}
        assignGroup={assignGroup}
      />

      <CreateGroupDialog
        open={createGroupDialogOpen}
        onClose={() => setCreateGroupDialogOpen(false)}
        onGroupCreated={handleGroupCreated}
      />

      {pendingMaskPolygons && (
        <AssignDrawnMaskDialog
          open={!!pendingMaskPolygons}
          onClose={() => setPendingMaskPolygons(null)}
          onAssign={handleAssignDrawnMask}
          groups={groups}
        />
      )}

      {/* ── Save Notification ────────────────────────────────────────────── */}
      {saveStatus === "saved" && (
        <div className="absolute bottom-6 right-6 z-[100] bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-medium">Saved to local storage</span>
        </div>
      )}
    </div>
  );
}
