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

import { memo, type ReactElement, useCallback, useEffect, useRef } from "react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { notNullOrUndefined } from "~lib/util/utils"

import {
  StyledFilterPill,
  StyledPillChevron,
  StyledPillContent,
  StyledPillLabel,
} from "./styled-components"

export interface FilterValue {
  type: string
  operator?: string
  values?: string[]
  query?: string
  min?: number | null
  max?: number | null
  start?: string | null
  end?: string | null
  value?: boolean | null
}

interface FilterPillProps {
  columnName: string
  filterValue: FilterValue
  displayOptions?: Map<string, string>
  isOpen: boolean
  disabled: boolean
  tabIndex: number
  pillRef: (node: HTMLButtonElement | null) => void
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void
  onPillMounted: (node: HTMLButtonElement | null) => void
  onFocus: () => void
}

function getSummaryText(
  filterValue: FilterValue,
  displayOptions?: Map<string, string>
): string {
  const { type, operator, values, query, min, max, start, end, value } =
    filterValue

  if (operator === "is_null") return "is null"
  if (operator === "is_not_null") return "is not null"

  switch (type) {
    case "multiselect": {
      if (!values || values.length === 0) return "All"
      const prefix = operator === "is_not" ? "≠ " : ""
      const display = values.map(v => displayOptions?.get(v) ?? v)
      if (display.length === 1) return `${prefix}${display[0]}`
      if (display.length === 2) return `${prefix}${display.join(", ")}`
      return `${prefix}${display.length} selected`
    }
    case "text": {
      if (!query) return "All"
      const truncated = query.length > 20 ? `${query.slice(0, 20)}...` : query
      return truncated
    }
    case "range": {
      if (operator === "equals" && notNullOrUndefined(min)) return `= ${min}`
      if (operator === "greater_than" && notNullOrUndefined(min))
        return `> ${min}`
      if (operator === "less_than" && notNullOrUndefined(max))
        return `< ${max}`
      if (notNullOrUndefined(min) && notNullOrUndefined(max))
        return `${min} – ${max}`
      if (notNullOrUndefined(min)) return `≥ ${min}`
      if (notNullOrUndefined(max)) return `≤ ${max}`
      return "All"
    }
    case "date_range":
    case "datetime_range": {
      if (operator === "equals" && start) return `= ${start}`
      if (operator === "before" && (end ?? start))
        return `before ${end ?? start}`
      if (operator === "after" && start) return `after ${start}`
      if (start && end) return `${start} – ${end}`
      if (start) return `from ${start}`
      if (end) return `until ${end}`
      return "All"
    }
    case "toggle": {
      if (value === true) return "True"
      if (value === false) return "False"
      return "All"
    }
    default:
      return "All"
  }
}

function FilterPill({
  columnName,
  filterValue,
  displayOptions,
  isOpen,
  disabled,
  tabIndex,
  pillRef,
  onToggle,
  onPillMounted,
  onFocus,
}: Readonly<FilterPillProps>): ReactElement {
  // A filter pill is always "active" (primary-colored) once it exists in the bar.
  // The presence of the filter means the user added it intentionally.
  const isActive = true
  const summary = getSummaryText(filterValue, displayOptions)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const setRef = useCallback(
    (node: HTMLButtonElement | null): void => {
      buttonRef.current = node
      pillRef(node)
    },
    [pillRef]
  )

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      onPillMounted(buttonRef.current)
    }
  }, [isOpen, onPillMounted])

  return (
    <StyledFilterPill
      ref={setRef}
      $isActive={isActive}
      $isOpen={isOpen}
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={onToggle}
      onFocus={onFocus}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={`Filter ${columnName}: ${summary}`}
    >
      <StyledPillContent>
        <StyledPillLabel>{columnName}: </StyledPillLabel>
        {summary}
      </StyledPillContent>
      <StyledPillChevron aria-hidden="true">
        <DynamicIcon
          iconValue={
            isOpen ? ":material/expand_less:" : ":material/expand_more:"
          }
          size="base"
        />
      </StyledPillChevron>
    </StyledFilterPill>
  )
}

export default memo(FilterPill)
