import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ContextMenu({
  position,
  onClose,
  onAssign,
  onDelete,
}) {
  return (
    <div
      className="absolute z-50"
      style={{ top: position.y, left: position.x }}
      onMouseLeave={onClose}
    >
      <Card className="p-2 shadow-xl w-48">
        <Button className="w-full mb-2" onClick={onAssign}>
          Change Group
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={onDelete}
        >
          Delete Selected
        </Button>
      </Card>
    </div>
  );
}
