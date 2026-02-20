
import { BudgetTable } from "../../components/budget/BudgetTable"
import { Receipt } from "lucide-react"

export function BudgetPage() {
    return (
        <div className="flex flex-col space-y-6 p-6 lg:p-8 max-w-[1600px] mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
                        <p className="text-sm text-muted-foreground">Manage procurement budget items</p>
                    </div>
                </div>
            </div>

            {/* Budget Table — always visible */}
            <BudgetTable />
        </div>
    )
}
