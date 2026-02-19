import { Stage, Layer, Line, Image as KonvaImage } from "react-konva";
import { useState, useRef } from "react";
import useImage from "use-image";
import floorImage from "../../data/floorplan.png";

export default function CanvasEditor({
  groups,
  masks,
  selectedMaskId,
  selectedGroupId,
  setSelectedMaskId,
}) {
  const [image] = useImage(floorImage);
  const stageRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const scaleBy = 1.08;
  const minScale = 0.2;
  const maxScale = 5;

  // --------------------
  // ZOOM HANDLER
  // --------------------
  const handleWheel = (e) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();

    const oldScale = scale;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    let newScale =
      e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setScale(newScale);
    setPosition(newPos);
  };

  // --------------------
  // PAN HANDLERS
  // --------------------
  const handleDragMove = (e) => {
    setPosition({
      x: e.target.x(),
      y: e.target.y(),
    });
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
      draggable   // now safe because we control state
      onDragMove={handleDragMove}
      onWheel={handleWheel}
      className="bg-gray-200"
    >
      <Layer>
        {image && <KonvaImage image={image} />}
      </Layer>

      <Layer>
        {masks.map((mask) => {
          const group = groups[mask.group_id];
          const isSelected = mask.id === selectedMaskId;
          const isGroupSelected = mask.group_id === selectedGroupId;

          return mask.polygons.map((polygon, index) => (
            <Line
              key={`${mask.id}-${index}`}
              points={polygon.flat()}
              closed
              fill={
                group
                  ? `rgba(${group.color[0]},${group.color[1]},${group.color[2]}, ${
                      isGroupSelected ? 0.8 : 0.4
                    })`
                  : "rgba(200,200,200,0.3)"
              }
              stroke={isSelected ? "red" : "black"}
              strokeWidth={isSelected ? 3 : 1}
              onClick={() => setSelectedMaskId(mask.id)}
            />
          ));
        })}
      </Layer>
    </Stage>
  );
}
