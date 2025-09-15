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

import React, { memo, ReactElement, useEffect, useRef, useState } from "react"

import styled from "@emotion/styled"

import { DropdownButton as DropdownButtonProto } from "@streamlit/protobuf"

import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { WidgetStateManager } from "~lib/WidgetStateManager"
import { Box } from "~lib/components/shared/Base/styled-components"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

export interface Props {
  disabled: boolean
  element: DropdownButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

const StyledDropdownContainer = styled.div`
  position: relative;
  display: inline-block;
`

const StyledDropdownMenu = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  display: ${({ isOpen }) => (isOpen ? "block" : "none")};
  background: ${({ theme }) => theme.colors.bgColor};
  border: 1px solid ${({ theme }) => theme.colors.borderColor};
  border-radius: ${({ theme }) => theme.radii.md};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: ${({ theme }) => theme.spacing.twoXS};
`

const StyledDropdownItem = styled.div<{ isFocused: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.bodyText};
  background-color: ${({ theme, isFocused }) =>
    isFocused ? theme.colors.secondaryBg : "transparent"};

  &:hover {
    background-color: ${({ theme }) => theme.colors.secondaryBg};
  }

  &:first-of-type {
    border-top-left-radius: ${({ theme }) => theme.radii.md};
    border-top-right-radius: ${({ theme }) => theme.radii.md};
  }

  &:last-of-type {
    border-bottom-left-radius: ${({ theme }) => theme.radii.md};
    border-bottom-right-radius: ${({ theme }) => theme.radii.md};
  }
`

function DropdownButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return

    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(0)
        } else if (
          focusedIndex >= 0 &&
          focusedIndex < element.options.length
        ) {
          handleOptionClick(element.options[focusedIndex])
        }
        break
      case "Escape":
        if (isOpen) {
          event.preventDefault()
          setIsOpen(false)
          setFocusedIndex(-1)
          containerRef.current?.querySelector("button")?.focus()
        }
        break
      case "ArrowDown":
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(0)
        } else {
          setFocusedIndex(prev =>
            prev < element.options.length - 1 ? prev + 1 : 0
          )
        }
        break
      case "ArrowUp":
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(element.options.length - 1)
        } else {
          setFocusedIndex(prev =>
            prev > 0 ? prev - 1 : element.options.length - 1
          )
        }
        break
    }
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setFocusedIndex(0)
      }
    }
  }

  const handleOptionClick = (option: string) => {
    setIsOpen(false)
    setFocusedIndex(-1)
    widgetMgr.setStringValue(element, option, { fromUi: true }, fragmentId)
  }

  const displayLabel = element.placeholder || "Select an option"

  return (
    <Box className="stDropdownButton" data-testid="stDropdownButton">
      <BaseButtonTooltip
        help={element.help}
        containerWidth={element.useContainerWidth}
      >
        <StyledDropdownContainer ref={containerRef} onKeyDown={handleKeyDown}>
          <BaseButton
            kind={kind}
            size={BaseButtonSize.SMALL}
            disabled={disabled}
            containerWidth={element.useContainerWidth}
            onClick={handleToggle}
          >
            <DynamicButtonLabel
              icon={element.icon}
              label={`${element.label}: ${displayLabel} ▼`}
            />
          </BaseButton>

          <StyledDropdownMenu
            isOpen={isOpen}
            role="listbox"
            aria-label={`${element.label} options`}
          >
            {element.options.map((option, index) => (
              <StyledDropdownItem
                key={index}
                isFocused={focusedIndex === index}
                onClick={() => handleOptionClick(option)}
                role="option"
                aria-selected={focusedIndex === index}
                tabIndex={-1}
              >
                {option}
              </StyledDropdownItem>
            ))}
          </StyledDropdownMenu>
        </StyledDropdownContainer>
      </BaseButtonTooltip>
    </Box>
  )
}

export default memo(DropdownButton)
