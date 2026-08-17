/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, type ReactElement, useCallback, useState } from "react"

import { FloatingPortal } from "@floating-ui/react"

import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"

import {
  StyledOperatorDropdown,
  StyledOperatorMenu,
  StyledOperatorMenuItem,
  StyledOperatorTrigger,
  StyledOperatorTriggerChevron,
} from "../styled-components"

const OPERATOR_LABELS: Record<string, string> = {
  is: "=",
  is_not: "≠",
  contains: "contains",
  not_contains: "not contains",
  equals: "=",
  not_equals: "≠",
  starts_with: "starts with",
  ends_with: "ends with",
  between: "between",
  not_between: "not between",
  greater_than: ">",
  less_than: "<",
  greater_than_or_equal: "≥",
  less_than_or_equal: "≤",
  before: "before",
  after: "after",
  is_true: "= true",
  is_false: "= false",
  is_null: "is empty",
  is_not_null: "not empty",
  past_7_days: "past 7 days",
  past_30_days: "past 30 days",
  past_90_days: "past 90 days",
  this_week: "this week",
  this_month: "this month",
  this_year: "this year",
  today: "today",
}

interface OperatorSelectorProps {
  operators: string[]
  currentOperator: string
  onChange: (operator: string) => void
  disabled: boolean
}

function OperatorSelector({
  operators,
  currentOperator,
  onChange,
  disabled,
}: Readonly<OperatorSelectorProps>): ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles } = useFloatingOverlay({
    open: isOpen,
    placement: "bottom-start",
    offsetPx: 4,
  })

  const { setFloatingRef } = useOverlayDismissal({
    isOpen,
    onClose: () => setIsOpen(false),
    floatingSetFn: refs.setFloating,
  })

  const handleToggle = useCallback((): void => {
    if (disabled) return
    setIsOpen(prev => !prev)
  }, [disabled])

  const handleSelect = useCallback(
    (op: string): void => {
      onChange(op)
      setIsOpen(false)
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (!disabled) {
          setIsOpen(prev => !prev)
        }
      }
    },
    [disabled]
  )

  return (
    <StyledOperatorDropdown>
      <StyledOperatorTrigger
        ref={refs.setReference}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label="Filter operator"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {OPERATOR_LABELS[currentOperator] ?? currentOperator}
        <StyledOperatorTriggerChevron aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </StyledOperatorTriggerChevron>
      </StyledOperatorTrigger>

      {isOpen && (
        <FloatingPortal id={FLOATING_OVERLAY_PORTAL_ID}>
          <StyledOperatorMenu
            ref={setFloatingRef}
            role="listbox"
            aria-label="Select operator"
            style={floatingStyles}
          >
            {operators.map(op => (
              <StyledOperatorMenuItem
                key={op}
                role="option"
                aria-selected={op === currentOperator}
                $isSelected={op === currentOperator}
                onClick={(): void => handleSelect(op)}
                type="button"
              >
                {OPERATOR_LABELS[op] ?? op}
              </StyledOperatorMenuItem>
            ))}
          </StyledOperatorMenu>
        </FloatingPortal>
      )}
    </StyledOperatorDropdown>
  )
}

export default memo(OperatorSelector)
