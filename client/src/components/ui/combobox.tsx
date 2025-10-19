import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  id?: string
  className?: string
  emptyMessage?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search...",
  required = false,
  id,
  className,
  emptyMessage = "No results found",
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption?.label || ""

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setOpen(false)
    setSearch("")
  }

  const handleInputClick = () => {
    setOpen(true)
    if (inputRef.current) {
      inputRef.current.select()
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={open ? search : displayValue}
        onChange={(e) => setSearch(e.target.value)}
        onClick={handleInputClick}
        onFocus={handleInputClick}
        placeholder={placeholder}
        required={required}
        className={cn(
          "flex h-10 w-full border border-gray-300 bg-white/90 backdrop-blur-sm px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:border-blue-500 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm focus-visible:shadow",
          className
        )}
        autoComplete="off"
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full border border-gray-200/60 bg-white/95 backdrop-blur-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-600">{emptyMessage}</div>
          ) : (
            <div className="py-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-all duration-200 hover:bg-gray-100/80",
                    option.value === value && "bg-blue-50/80 text-blue-600 font-medium"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
