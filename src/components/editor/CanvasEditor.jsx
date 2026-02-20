import { Stage, Layer, Line, Image as KonvaImage, Rect } from "react-konva";
import { useState, useRef } from "react";
import useImage from "use-image";
import floorImage from "../../data/floorplan.png";

export default function CanvasEditor({
  groups,
  masks,
  selectedMaskIds,
  setSelectedMaskIds,
  selectedGroupId,
  setSelectedGroupId,
  editorMode,
  changeGroupMode, // boolean — reassign mode is active
  toggleMaskSelection, // (id, isShift) => void
  setContextMenu,
  onCtrlClickMask, // (maskId, { x, y }) => void — Ctrl+Click in reassign mode
}) {
  const [image] = useImage(floorImage);
  const stageRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // ── Shift-drag selection box ───────────────────────────────────────────────
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionStartRef = useRef(null);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const oldScale = scale;
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / 1.08 : oldScale * 1.08;
    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // ── Shift-drag mouse handlers ─────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.evt.shiftKey) {
      // In reassign mode: Shift+Click on a MASK should toggle selection (handled
      // by the Line's onClick). Only start a drag-selection box when clicking the
      // background (stage itself). Without this guard, isSelecting gets set to
      // true before the click event fires, blocking handleMaskClick.
      const isBackgroundClick = e.target === e.target.getStage();
      if (changeGroupMode && editorMode === "group" && !isBackgroundClick) {
        return; // Let the Line's onClick handle this Shift+Click
      }

      const stage = e.target.getStage();
      const pos = stage.getRelativePointerPosition();
      selectionStartRef.current = pos;
      setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setIsSelecting(true);
    }
  };

  const handleMouseMove = (e) => {
    if (!isSelecting) return;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pos = stage.getRelativePointerPosition();
    const start = selectionStartRef.current;
    setSelectionBox({
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      width: Math.abs(pos.x - start.x),
      height: Math.abs(pos.y - start.y),
    });
  };

  const handleMouseUp = (e) => {
    if (!isSelecting) return;

    if (selectionBox) {
      const box = selectionBox;
      const selectedIds = [];

      masks.forEach((mask) => {
        if (!mask.polygons) return;
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        mask.polygons.forEach((polygon) => {
          polygon.flat().forEach((v, i) => {
            if (i % 2 === 0) {
              minX = Math.min(minX, v);
              maxX = Math.max(maxX, v);
            } else {
              minY = Math.min(minY, v);
              maxY = Math.max(maxY, v);
            }
          });
        });
        const maskBox = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
        if (
          maskBox.x >= box.x &&
          maskBox.x + maskBox.width <= box.x + box.width &&
          maskBox.y >= box.y &&
          maskBox.y + maskBox.height <= box.y + box.height
        ) {
          selectedIds.push(mask.id);
        }
      });

      if (setSelectedMaskIds) setSelectedMaskIds(selectedIds);
    }

    setSelectionBox(null);
    setIsSelecting(false);
  };

  // ── Per-mask click handler ────────────────────────────────────────────────
  const handleMaskClick = (e, mask) => {
    if (isSelecting) return; // drag-select in progress, ignore clicks

    const isShift = e.evt.shiftKey;
    const isCtrl = e.evt.ctrlKey || e.evt.metaKey;

    if (changeGroupMode && editorMode === "group") {
      // ────────────────────────────────────────────────────────────────────
      // REASSIGN MODE
      // Ctrl+Click → add to selection (if needed) then show group popover
      // Shift+Click → toggle in/out of multi-selection
      // Plain click → deselect all, select only this mask
      // ────────────────────────────────────────────────────────────────────
      if (isCtrl) {
        onCtrlClickMask?.(mask.id, { x: e.evt.clientX, y: e.evt.clientY });
      } else {
        toggleMaskSelection(mask.id, isShift);
      }
    } else {
      // ────────────────────────────────────────────────────────────────────
      // NORMAL MODE — existing behaviour
      // ────────────────────────────────────────────────────────────────────
      toggleMaskSelection?.(mask.id, isShift);
      if (editorMode === "group" && setSelectedGroupId) {
        setSelectedGroupId(mask.group_id);
      }
    }
  };

  // ── Canvas opacity logic ──────────────────────────────────────────────────
  const getMaskOpacity = (mask) => {
    const isActiveGroup = mask.group_id === selectedGroupId;

    if (editorMode !== "group") return 0.4; // show-all mode

    if (changeGroupMode) {
      // In reassign mode: raise opacity of all masks so users can see / click them.
      // Active group stays brighter; others visible but dimmed.
      return isActiveGroup ? 0.65 : 0.3;
    }

    // Normal group mode
    if (!selectedGroupId) return 0.2;
    return isActiveGroup ? 0.7 : 0.05;
  };

  // ── Stroke colour for selected masks ─────────────────────────────────────
  const getMaskStroke = (isSelected) => {
    if (!isSelected) return "black";
    // Amber in reassign mode to visually distinguish from normal selection
    return changeGroupMode ? "#f97316" : "red";
  };

  return (
    <Stage
      ref={stageRef}
      width={window.innerWidth - 300}
      height={window.innerHeight}
      scaleX={scale}
      scaleY={scale}
      x={position.x}
      y={position.y}
      draggable={!isSelecting}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragStart={(e) => {
        if (isSelecting) e.target.stopDrag();
      }}
      onDragMove={(e) => {
        if (!isSelecting) setPosition({ x: e.target.x(), y: e.target.y() });
      }}
      onWheel={handleWheel}
      // Background click → deselect all (in reassign mode)
      onClick={(e) => {
        if (e.target === e.target.getStage() && changeGroupMode) {
          setSelectedMaskIds?.([]);
        }
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        if (selectedMaskIds?.length > 0) {
          setContextMenu({ x: e.evt.clientX, y: e.evt.clientY });
        }
      }}
    >
      {/* Floor plan image */}
      <Layer>{image && <KonvaImage image={image} />}</Layer>

      {/* Masks */}
      <Layer>
        {masks.map((mask) => {
          const isSelected = selectedMaskIds?.includes(mask.id) ?? false;
          const opacity = getMaskOpacity(mask);
          const groupData = groups?.[mask.group_id] ?? null;
          const fillColor = groupData
            ? `rgba(${groupData.color[0]},${groupData.color[1]},${groupData.color[2]},${opacity})`
            : `rgba(200,200,200,${opacity})`;
          const strokeColor = getMaskStroke(isSelected);
          const strokeWidth = isSelected ? 3 : 1;

          return mask.polygons.map((polygon, idx) => (
            <Line
              key={`${mask.id}-${idx}`}
              points={polygon.flat()}
              closed
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              onClick={(e) => handleMaskClick(e, mask)}
            />
          ));
        })}

        {/* Shift-drag selection rectangle */}
        {selectionBox && (
          <Rect
            x={selectionBox.x}
            y={selectionBox.y}
            width={selectionBox.width}
            height={selectionBox.height}
            fill="rgba(0,161,255,0.15)"
            stroke="#3b82f6"
            strokeWidth={1 / scale}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
}
