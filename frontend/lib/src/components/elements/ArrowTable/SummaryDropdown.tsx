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
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { KeyboardArrowDown } from "@emotion-icons/material-outlined"
import { createPortal } from "react-dom"

import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import { Quiver } from "~lib/dataframes/Quiver"

import {
  StyledDropdownArrow,
  StyledDropdownItemLabel,
  StyledDropdownItemValue,
  StyledHiddenItem,
  StyledStackedContainer,
  StyledSummaryContent,
  StyledSummaryDropdownButton,
  StyledSummaryDropdownContainer,
  StyledSummaryDropdownItem,
  StyledSummaryDropdownMenu,
  StyledSummaryLabel,
  StyledSummaryValue,
} from "./styled-components"
import {
  ALL_SUMMARY_TYPES,
  computeSummary,
  getSummaryLabel,
  SummaryType,
} from "./summaryUtils"

export interface SummaryDropdownProps {
  table: Quiver
  columnIndex: number
  defaultType: SummaryType
}

function SummaryDropdown({
  table,
  columnIndex,
  defaultType,
}: Readonly<SummaryDropdownProps>): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<SummaryType>(defaultType)
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(0, ALL_SUMMARY_TYPES.indexOf(defaultType))
  )
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { innerWidth: windowWidth, innerHeight: windowHeight } =
    useWindowDimensionsContext()

  // Pre-compute all summary values
  const allSummaryValues = useMemo(() => {
    const values: Record<SummaryType, string> = {} as Record<
      SummaryType,
      string
    >
    for (const type of ALL_SUMMARY_TYPES) {
      values[type] = computeSummary(table, columnIndex, type)
    }
    return values
  }, [table, columnIndex])

  // Update menu position when opening and focus the selected item
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      // Use double requestAnimationFrame to ensure menu is rendered before measuring
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (buttonRef.current && menuRef.current) {
            // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Position calculation needed for portal
            const buttonRect = buttonRef.current.getBoundingClientRect()
            // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Position calculation needed for portal
            const menuHeight = menuRef.current.offsetHeight
            const spaceBelow = windowHeight - buttonRect.bottom
            const spaceAbove = buttonRect.top

            // Position above if not enough space below and more space above
            const shouldFlip =
              spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow

            setMenuPosition({
              top: shouldFlip
                ? buttonRect.top - menuHeight - 4
                : buttonRect.bottom + 4,
              right: windowWidth - buttonRect.right,
            })
          }
          // Focus the selected item after position is set
          const selectedIdx = ALL_SUMMARY_TYPES.indexOf(selectedType)
          if (selectedIdx >= 0 && itemRefs.current[selectedIdx]) {
            itemRefs.current[selectedIdx]?.focus()
          }
        })
      })
    }
  }, [isOpen, windowWidth, windowHeight, selectedType])

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    const handleScroll = (): void => {
      setIsOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    // Close on any scroll to prevent the dropdown from floating away
    window.addEventListener("scroll", handleScroll, true)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [isOpen])

  const handleToggle = useCallback((): void => {
    setIsOpen(prev => {
      if (!prev) {
        // When opening, reset focus to the selected item
        const selectedIdx = ALL_SUMMARY_TYPES.indexOf(selectedType)
        setFocusedIndex(selectedIdx >= 0 ? selectedIdx : 0)
      }
      return !prev
    })
  }, [selectedType])

  const handleSelect = useCallback((type: SummaryType): void => {
    setSelectedType(type)
    setIsOpen(false)
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent): void => {
    if (event.key === "Escape") {
      setIsOpen(false)
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setIsOpen(prev => !prev)
    }
  }, [])

  const handleMenuKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number, type: SummaryType): void => {
      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault()
          handleSelect(type)
          buttonRef.current?.focus()
          break
        case "ArrowDown":
          event.preventDefault()
          {
            const nextIndex = (index + 1) % ALL_SUMMARY_TYPES.length
            setFocusedIndex(nextIndex)
            itemRefs.current[nextIndex]?.focus()
          }
          break
        case "ArrowUp":
          event.preventDefault()
          {
            const prevIndex =
              (index - 1 + ALL_SUMMARY_TYPES.length) % ALL_SUMMARY_TYPES.length
            setFocusedIndex(prevIndex)
            itemRefs.current[prevIndex]?.focus()
          }
          break
        case "Escape":
          event.preventDefault()
          setIsOpen(false)
          buttonRef.current?.focus()
          break
        case "Tab":
          // Close dropdown on Tab to allow normal tab navigation
          setIsOpen(false)
          break
      }
    },
    [handleSelect]
  )

  return (
    <StyledSummaryDropdownContainer>
      <StyledSummaryDropdownButton
        ref={buttonRef}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="stTableSummaryDropdownButton"
      >
        <StyledStackedContainer>
          {/* Render all label+value combinations stacked to maintain consistent width */}
          {ALL_SUMMARY_TYPES.map(type =>
            type === selectedType ? (
              <StyledSummaryContent key={type}>
                <StyledSummaryLabel>
                  {getSummaryLabel(type)}:
                </StyledSummaryLabel>
                <StyledSummaryValue>
                  {allSummaryValues[type]}
                </StyledSummaryValue>
                <StyledDropdownArrow>
                  <KeyboardArrowDown />
                </StyledDropdownArrow>
              </StyledSummaryContent>
            ) : (
              <StyledHiddenItem key={type} aria-hidden="true">
                <StyledSummaryContent>
                  <StyledSummaryLabel>
                    {getSummaryLabel(type)}:
                  </StyledSummaryLabel>
                  <StyledSummaryValue>
                    {allSummaryValues[type]}
                  </StyledSummaryValue>
                  <StyledDropdownArrow>
                    <KeyboardArrowDown />
                  </StyledDropdownArrow>
                </StyledSummaryContent>
              </StyledHiddenItem>
            )
          )}
        </StyledStackedContainer>
      </StyledSummaryDropdownButton>

      {isOpen &&
        createPortal(
          <StyledSummaryDropdownMenu
            ref={menuRef}
            role="listbox"
            data-testid="stTableSummaryDropdownMenu"
            style={{
              top: menuPosition.top,
              right: menuPosition.right,
            }}
          >
            {ALL_SUMMARY_TYPES.map((type, index) => (
              <StyledSummaryDropdownItem
                key={type}
                ref={el => {
                  itemRefs.current[index] = el
                }}
                isSelected={type === selectedType}
                isFocused={index === focusedIndex}
                onClick={() => handleSelect(type)}
                onKeyDown={e => handleMenuKeyDown(e, index, type)}
                role="option"
                aria-selected={type === selectedType}
                tabIndex={index === focusedIndex ? 0 : -1}
                data-testid={`stTableSummaryDropdownItem-${type}`}
              >
                <StyledDropdownItemLabel>
                  {getSummaryLabel(type)}:
                </StyledDropdownItemLabel>
                <StyledDropdownItemValue>
                  {allSummaryValues[type]}
                </StyledDropdownItemValue>
              </StyledSummaryDropdownItem>
            ))}
          </StyledSummaryDropdownMenu>,
          document.body
        )}
    </StyledSummaryDropdownContainer>
  )
}

export default memo(SummaryDropdown)
