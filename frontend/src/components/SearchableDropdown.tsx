"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X, Search } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      o.value.toLowerCase().includes(query.toLowerCase()) ||
      (o.sublabel || "").toLowerCase().includes(query.toLowerCase())
  );

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      setQuery("");
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setQuery("");
    },
    [onChange]
  );

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const [highlightIdx, setHighlightIdx] = useState(0);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIdx]) handleSelect(filtered[highlightIdx].value);
        break;
      case "Escape":
        setIsOpen(false);
        setQuery("");
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm outline-none text-left transition-colors"
        style={{
          backgroundColor: "var(--bg-dark)",
          border: isOpen ? "1px solid var(--accent)" : "1px solid var(--bg-border)",
          color: selectedOption ? "var(--text-primary)" : "var(--text-tertiary)",
        }}
      >
        <span className="truncate">
          {selectedOption
            ? `${selectedOption.label}${selectedOption.sublabel ? ` (${selectedOption.sublabel})` : ""}`
            : placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-white/10 cursor-pointer"
            >
              <X className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            style={{ color: "var(--text-tertiary)" }}
          />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg overflow-hidden"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--bg-border)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "280px",
          }}
        >
          {/* Search input */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-b"
            style={{ borderColor: "var(--bg-border)" }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to filter..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
            {filtered.length > 0 ? (
              filtered.map((opt, idx) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{
                    backgroundColor:
                      idx === highlightIdx
                        ? "var(--accent-light)"
                        : opt.value === value
                          ? "var(--bg-dark)"
                          : "transparent",
                    color:
                      idx === highlightIdx
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                >
                  <span className="font-medium">{opt.label}</span>
                  {opt.sublabel && (
                    <span
                      className="ml-2 text-xs font-mono"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <p
                className="px-3 py-4 text-sm text-center"
                style={{ color: "var(--text-tertiary)" }}
              >
                No matches found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
