import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function Sidebar({
  groups,
  masks,
  selectedMaskId,
  selectedGroupId,
  setSelectedGroupId,
  setGroups,
  setMasks,
}) {
  const handleChangeGroup = (groupId) => {
    setMasks((prev) =>
      prev.map((mask) =>
        mask.id === selectedMaskId
          ? { ...mask, group_id: groupId }
          : mask
      )
    );
  };

  const handleCreateGroup = () => {
    const id = `group_${Date.now()}`;
    setGroups({
      ...groups,
      [id]: {
        id,
        name: "New Group",
        code: "",
        color: [100, 150, 250],
      },
    });
  };

  const handleDeleteGroup = (groupId) => {
    const updatedGroups = { ...groups };
    delete updatedGroups[groupId];

    setGroups(updatedGroups);

    setMasks((prev) =>
      prev.map((mask) =>
        mask.group_id === groupId
          ? { ...mask, group_id: null }
          : mask
      )
    );
  };

  return (
    <div className="w-72 border-r p-4 overflow-y-auto bg-white">
      <h2 className="text-lg font-semibold mb-4">Groups</h2>

      <Button className="mb-4 w-full" onClick={handleCreateGroup}>
        Create Group
      </Button>

      {Object.values(groups).map((group) => (
        <Card
          key={group.id}
          className={`p-3 mb-3 cursor-pointer ${
            selectedGroupId === group.id ? "border-2 border-blue-500" : ""
          }`}
          onClick={() => setSelectedGroupId(group.id)}
        >
          <div className="flex justify-between items-center">
            <span>{group.name}</span>
            <div
              className="w-4 h-4 rounded"
              style={{
                backgroundColor: `rgb(${group.color.join(",")})`,
              }}
            />
          </div>

          {selectedMaskId && (
            <Button
              className="mt-2 w-full"
              onClick={() => handleChangeGroup(group.id)}
            >
              Assign Selected Mask
            </Button>
          )}

          <Button
            variant="destructive"
            className="mt-2 w-full"
            onClick={() => handleDeleteGroup(group.id)}
          >
            Delete
          </Button>
        </Card>
      ))}
    </div>
  );
}
