
import { useState, useEffect } from "react"
import { Input } from "./ui/input"
import { Search } from "lucide-react"

export function SearchInput({ value, onChange, placeholder = "Search..." }) {
    const [localValue, setLocalValue] = useState(value)

    useEffect(() => {
        setLocalValue(value)
    }, [value])

    useEffect(() => {
        const handler = setTimeout(() => {
            if (localValue !== value) {
                onChange(localValue)
            }
        }, 300)

        return () => clearTimeout(handler)
    }, [localValue, onChange, value])

    return (
        <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder={placeholder}
                className="pl-8 w-full md:w-[300px]"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
            />
        </div>
    )
}
