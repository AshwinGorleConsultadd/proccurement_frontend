
import { Button } from "../ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function PaginationControls({ page, pageSize, total, onPageChange }) {
    const totalPages = Math.ceil(total / pageSize) || 1

    return (
        <div className="flex items-center justify-end space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground hidden sm:block">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
            </div>
            <div className="space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
