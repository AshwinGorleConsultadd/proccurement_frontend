import { useState, useEffect } from "react";
import editorData from "../../data/editor_data.json";
import CanvasEditor from "./CanvasEditor";
import Sidebar from "./Sidebar";
import ContextMenu from "./ContextMenu";
import GroupDialog from "./GroupDialog";
import CreateGroupDialog from "./CreateGroupDialog";
import GroupAssignPopover from "./GroupAssignPopover";

export default function EditorLayout() {
  // ─── Core state ────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState(editorData.groups);
  const [masks, setMasks] = useState(editorData.masks);
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

  // ─── Undo / Redo ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState([
    { masks: editorData.masks, groups: editorData.groups },
  ]);
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
  }, [historyIndex, history, selectedMaskIds]);

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
        className="flex-1 overflow-hidden"
        style={{
          backgroundColor: "#f0f0f0",
          backgroundImage:
            "radial-gradient(circle, #b0b0b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
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
    </div>
  );
}
