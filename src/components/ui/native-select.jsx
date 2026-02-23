"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "../../lib/utils"

// Since Radix Select is complex and requires @radix-ui/react-select package which we haven't installed individually (we should have), 
// wait, I did not install @radix-ui/react-select in the first npm install command.
// I installed: @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tooltip @radix-ui/react-tabs
// I did NOT install @radix-ui/react-select.
// I'll use a standard HTML select with custom styling for now to avoid breaking the build, or I'll implement a custom one.
// Actually, for "Select" I'll use a simple styled native select for now if I don't want to install more packages, 
// BUT for a "Premium" feel, a native select is okay if styled well, or I can install the package.
// Let's stick to native select for simplicity and robustness unless requested otherwise, OR use the existing DropdownMenu to mimic a Select.
// Given the instructions "Use Rich Aesthetics", I'll try to use a styled native select that looks good.

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
    return (
        <div className="relative">
            <select
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
                    className
                )}
                ref={ref}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
    )
})
Select.displayName = "Select"

const SelectTrigger = ({ className, children }) => <div className={className}>{children}</div>
const SelectValue = ({ children }) => <span>{children}</span>
const SelectContent = ({ children }) => <>{children}</>
const SelectItem = ({ children, value }) => <option value={value}>{children}</option>

// Actually, to make it compatible with the expected Radix API if I were to swap it later, I'll export these.
// But for a native select, we just use <Select><option...></Select>.

export { Select, SelectItem }
