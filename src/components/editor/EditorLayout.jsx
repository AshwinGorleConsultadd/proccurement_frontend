import { useState } from "react";
import editorData from "../../data/editor_data.json";
import CanvasEditor from "./CanvasEditor";
import Sidebar from "./Sidebar";

export default function EditorLayout() {
  const [groups, setGroups] = useState(editorData.groups);
  const [masks, setMasks] = useState(editorData.masks);
  const [selectedMaskId, setSelectedMaskId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  return (
    <div className="flex h-screen">
      <Sidebar
        groups={groups}
        masks={masks}
        selectedMaskId={selectedMaskId}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        setGroups={setGroups}
        setMasks={setMasks}
      />

      <div className="flex-1 bg-gray-100 overflow-hidden">
        <CanvasEditor
          groups={groups}
          masks={masks}
          selectedMaskId={selectedMaskId}
          selectedGroupId={selectedGroupId}
          setSelectedMaskId={setSelectedMaskId}
        />
      </div>
    </div>

  );
}
