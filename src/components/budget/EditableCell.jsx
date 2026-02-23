
import { Input } from "./ui/input"
import { useEffect, useState, useRef } from "react"

export function EditableCell({
    value,
    isEditable,
    onChange,
    onBlur,
    onKeyDown,
    type = "text",
    className,
}) {
    const [localValue, setLocalValue] = useState(value)
    const inputRef = useRef(null)

    useEffect(() => {
        setLocalValue(value)
    }, [value])

    const handleChange = (e) => {
        setLocalValue(e.target.value)
        onChange?.(e.target.value)
    }

    if (isEditable) {
        return (
            <Input
                ref={inputRef}
                value={localValue}
                onChange={handleChange}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                type={type}
                className={`h-8 w-full ${className}`}
                autoFocus
            />
        )
    }

    return <span className={`block w-full truncate ${className}`}>{value}</span>
}
