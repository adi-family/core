import { useState, useRef, useEffect } from "react"
import { cn } from "./lib/utils"
import { Portal } from "./portal"

export interface ComboboxOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface ComboboxProps {
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption?.label || ""

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Check if click is outside both the container and any portaled dropdown
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target)
      const isOutsideDropdown = !target.closest('[data-combobox-dropdown]')

      if (isOutsideContainer && isOutsideDropdown) {
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

  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

      setDropdownPosition({
        top: rect.bottom + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width
      })
    }
  }

  const handleInputClick = () => {
    setOpen(true)
    // Update position after state change to ensure correct positioning
    setTimeout(() => {
      updateDropdownPosition()
    }, 0)
    if (inputRef.current) {
      inputRef.current.select()
    }
  }

  // Update position when dropdown opens or on scroll/resize
  useEffect(() => {
    if (open) {
      updateDropdownPosition()

      const handleScroll = () => updateDropdownPosition()
      const handleResize = () => updateDropdownPosition()

      // Listen to scroll on all scrollable ancestors
      document.addEventListener('scroll', handleScroll, true)
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)

      return () => {
        document.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [open])

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
          "flex h-10 w-full rounded-lg border border-slate-600/50 bg-slate-700/40 backdrop-blur-sm px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:border-blue-500 hover:border-slate-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 shadow-sm focus-visible:shadow-lg",
          className
        )}
        autoComplete="off"
      />

      {open && (
        <Portal>
          <div
            data-combobox-dropdown
            className="absolute rounded-lg border border-slate-700/50 bg-slate-800/95 backdrop-blur-md shadow-xl max-h-60 overflow-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 9999
            }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">{emptyMessage}</div>
            ) : (
              <div className="py-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(option.value)
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm text-gray-200 transition-all duration-200 hover:bg-slate-700/80 flex items-center gap-2",
                      option.value === value && "bg-blue-500/20 text-blue-400 font-medium"
                    )}
                  >
                    {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Portal>
      )}
    </div>
  )
}
