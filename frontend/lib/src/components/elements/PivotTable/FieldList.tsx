/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, {
  KeyboardEvent,
  memo,
  ReactElement,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  StyledFieldItem,
  StyledFieldList,
  StyledFieldMenu,
} from "./styled-components"

interface FieldListProps {
  fields: string[]
  onAddToRows: (fieldName: string) => void
  onAddToColumns: (fieldName: string) => void
  onAddToValues: (fieldName: string) => void
}

function FieldList({
  fields,
  onAddToRows,
  onAddToColumns,
  onAddToValues,
}: FieldListProps): ReactElement {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }

    if (activeMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
    return undefined
  }, [activeMenu])

  const handleFieldClick = (field: string): void => {
    if (activeMenu === field) {
      setActiveMenu(null)
    } else {
      setActiveMenu(field)
      setFocusedIndex(0)
    }
  }

  const handleAddTo = (
    field: string,
    target: "rows" | "columns" | "values"
  ): void => {
    if (target === "rows") {
      onAddToRows(field)
    } else if (target === "columns") {
      onAddToColumns(field)
    } else {
      onAddToValues(field)
    }
    setActiveMenu(null)
  }

  const handleKeyDown = (event: KeyboardEvent, field: string): void => {
    if (!activeMenu) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setActiveMenu(field)
        setFocusedIndex(0)
      }
      return
    }

    const options = ["rows", "columns", "values"]

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        setFocusedIndex(prev => (prev + 1) % options.length)
        break
      case "ArrowUp":
        event.preventDefault()
        setFocusedIndex(prev => (prev - 1 + options.length) % options.length)
        break
      case "Enter":
        event.preventDefault()
        handleAddTo(
          field,
          options[focusedIndex] as "rows" | "columns" | "values"
        )
        break
      case "Escape":
        event.preventDefault()
        setActiveMenu(null)
        break
      default:
        break
    }
  }

  return (
    <StyledFieldList>
      {fields.map((field, index) => (
        <div
          key={index}
          style={{ position: "relative" }}
          ref={activeMenu === field ? menuRef : null}
        >
          <StyledFieldItem
            onClick={() => handleFieldClick(field)}
            onKeyDown={(e: KeyboardEvent) => handleKeyDown(e, field)}
            tabIndex={0}
            role="button"
            aria-haspopup="true"
            aria-expanded={activeMenu === field}
            title={`Click to choose where to add ${field}`}
          >
            {field}
          </StyledFieldItem>
          {activeMenu === field && (
            <StyledFieldMenu role="menu">
              <button
                onClick={() => handleAddTo(field, "rows")}
                style={{
                  backgroundColor:
                    focusedIndex === 0 ? "rgba(0, 0, 0, 0.05)" : "transparent",
                }}
                role="menuitem"
              >
                Add to Rows
              </button>
              <button
                onClick={() => handleAddTo(field, "columns")}
                style={{
                  backgroundColor:
                    focusedIndex === 1 ? "rgba(0, 0, 0, 0.05)" : "transparent",
                }}
                role="menuitem"
              >
                Add to Columns
              </button>
              <button
                onClick={() => handleAddTo(field, "values")}
                style={{
                  backgroundColor:
                    focusedIndex === 2 ? "rgba(0, 0, 0, 0.05)" : "transparent",
                }}
                role="menuitem"
              >
                Add to Values
              </button>
            </StyledFieldMenu>
          )}
        </div>
      ))}
    </StyledFieldList>
  )
}

export default memo(FieldList)
