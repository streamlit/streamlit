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

import { memo, type ReactElement, useCallback } from "react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"

import {
  StyledFilterDeleteButton,
  StyledFilterHeader,
  StyledFilterHeaderLeft,
  StyledFilterHeaderTitle,
  StyledMiniInput,
  StyledRangeRow,
  StyledRangeSeparator,
  StyledRelativeDateLabel,
} from "../styled-components"

import OperatorSelector from "./OperatorSelector"

function isNullOperator(op: string): boolean {
  return op === "is_null" || op === "is_not_null"
}

function isSingleValueOperator(op: string): boolean {
  return (
    op === "equals" || op === "not_equals" || op === "before" || op === "after"
  )
}

const RELATIVE_OPERATOR_LABELS: Record<string, string> = {
  past_7_days: "Past 7 days",
  past_30_days: "Past 30 days",
  past_90_days: "Past 90 days",
  this_week: "This week",
  this_month: "This month",
  this_year: "This year",
  today: "Today",
}

function isRelativeOperator(op: string): boolean {
  return op in RELATIVE_OPERATOR_LABELS
}

interface DateRangeFilterProps {
  columnName: string
  currentStart: string | null
  currentEnd: string | null
  operators: string[]
  currentOperator: string
  onOperatorChange: (operator: string) => void
  onChange: (start: string | null, end: string | null) => void
  onDelete: () => void
  disabled: boolean
}

function DateRangeFilter({
  columnName,
  currentStart,
  currentEnd,
  operators,
  currentOperator,
  onOperatorChange,
  onChange,
  onDelete,
  disabled,
}: Readonly<DateRangeFilterProps>): ReactElement {
  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const val = e.target.value || null
      onChange(val, currentEnd)
    },
    [currentEnd, onChange]
  )

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const val = e.target.value || null
      onChange(currentStart, val)
    },
    [currentStart, onChange]
  )

  return (
    <div>
      <StyledFilterHeader>
        <StyledFilterHeaderLeft>
          <StyledFilterHeaderTitle>{columnName}</StyledFilterHeaderTitle>
          {operators.length > 1 && (
            <OperatorSelector
              operators={operators}
              currentOperator={currentOperator}
              onChange={onOperatorChange}
              disabled={disabled}
            />
          )}
        </StyledFilterHeaderLeft>
        <StyledFilterDeleteButton
          onClick={onDelete}
          aria-label={`Remove ${columnName} filter`}
        >
          <DynamicIcon iconValue=":material/delete:" size="md" />
        </StyledFilterDeleteButton>
      </StyledFilterHeader>

      {!isNullOperator(currentOperator) &&
        isRelativeOperator(currentOperator) && (
          <StyledRelativeDateLabel>
            {RELATIVE_OPERATOR_LABELS[currentOperator]}
          </StyledRelativeDateLabel>
        )}
      {!isNullOperator(currentOperator) &&
        !isRelativeOperator(currentOperator) &&
        isSingleValueOperator(currentOperator) && (
          <StyledMiniInput
            type="date"
            value={currentStart ?? ""}
            onChange={handleStartChange}
            disabled={disabled}
            aria-label={`${columnName} date`}
          />
        )}
      {!isNullOperator(currentOperator) &&
        !isRelativeOperator(currentOperator) &&
        !isSingleValueOperator(currentOperator) && (
          <StyledRangeRow>
            <StyledMiniInput
              type="date"
              value={currentStart ?? ""}
              onChange={handleStartChange}
              disabled={disabled}
              aria-label={`${columnName} start date`}
            />
            <StyledRangeSeparator>–</StyledRangeSeparator>
            <StyledMiniInput
              type="date"
              value={currentEnd ?? ""}
              onChange={handleEndChange}
              disabled={disabled}
              aria-label={`${columnName} end date`}
            />
          </StyledRangeRow>
        )}
    </div>
  )
}

export default memo(DateRangeFilter)
