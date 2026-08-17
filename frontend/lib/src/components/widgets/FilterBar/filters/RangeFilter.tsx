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

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { notNullOrUndefined } from "~lib/util/utils"

import {
  StyledFilterDeleteButton,
  StyledFilterHeader,
  StyledFilterHeaderLeft,
  StyledFilterHeaderTitle,
  StyledMiniInput,
  StyledRangeRow,
  StyledRangeSeparator,
} from "../styled-components"

import OperatorSelector from "./OperatorSelector"

interface RangeFilterProps {
  columnName: string
  columnMin?: number | null
  columnMax?: number | null
  currentMin?: number | null
  currentMax?: number | null
  operators: string[]
  currentOperator: string
  onOperatorChange: (operator: string) => void
  onChange: (min: number | null, max: number | null) => void
  onDelete: () => void
  disabled: boolean
}

function isNullOperator(op: string): boolean {
  return op === "is_null" || op === "is_not_null"
}

function isSingleValueOperator(op: string): boolean {
  return (
    op === "equals" ||
    op === "not_equals" ||
    op === "greater_than" ||
    op === "less_than"
  )
}

function RangeFilter({
  columnName,
  columnMin,
  columnMax,
  currentMin,
  currentMax,
  operators,
  currentOperator,
  onOperatorChange,
  onChange,
  onDelete,
  disabled,
}: Readonly<RangeFilterProps>): ReactElement {
  const [localMin, setLocalMin] = useState(
    notNullOrUndefined(currentMin) ? String(currentMin) : ""
  )
  const [localMax, setLocalMax] = useState(
    notNullOrUndefined(currentMax) ? String(currentMax) : ""
  )

  const commitValues = useCallback((): void => {
    const min = localMin !== "" ? Number(localMin) : null
    const max = localMax !== "" ? Number(localMax) : null
    onChange(
      notNullOrUndefined(min) && !isNaN(min) ? min : null,
      notNullOrUndefined(max) && !isNaN(max) ? max : null
    )
  }, [localMin, localMax, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === "Enter") {
        commitValues()
      }
    },
    [commitValues]
  )

  const isSingleValueOp = isSingleValueOperator(currentOperator)

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

      {!isNullOperator(currentOperator) && isSingleValueOp && (
        <StyledMiniInput
          type="number"
          value={localMin}
          onChange={(e): void => setLocalMin(e.target.value)}
          onBlur={commitValues}
          onKeyDown={handleKeyDown}
          placeholder="Enter value..."
          disabled={disabled}
          aria-label={`${columnName} value`}
        />
      )}
      {!isNullOperator(currentOperator) && !isSingleValueOp && (
        <StyledRangeRow>
          <StyledMiniInput
            type="number"
            value={localMin}
            onChange={(e): void => setLocalMin(e.target.value)}
            onBlur={commitValues}
            onKeyDown={handleKeyDown}
            placeholder={
              notNullOrUndefined(columnMin) ? String(columnMin) : "Min"
            }
            disabled={disabled}
            aria-label={`${columnName} minimum`}
          />
          <StyledRangeSeparator>–</StyledRangeSeparator>
          <StyledMiniInput
            type="number"
            value={localMax}
            onChange={(e): void => setLocalMax(e.target.value)}
            onBlur={commitValues}
            onKeyDown={handleKeyDown}
            placeholder={
              notNullOrUndefined(columnMax) ? String(columnMax) : "Max"
            }
            disabled={disabled}
            aria-label={`${columnName} maximum`}
          />
        </StyledRangeRow>
      )}
    </div>
  )
}

export default memo(RangeFilter)
