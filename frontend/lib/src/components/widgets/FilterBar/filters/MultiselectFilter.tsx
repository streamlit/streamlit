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

import { memo, type ReactElement, useCallback, useMemo, useState } from "react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"

import {
  StyledCheckboxInput,
  StyledCheckboxItem,
  StyledCheckboxLabel,
  StyledCheckboxList,
  StyledCheckboxMark,
  StyledEmptyMessage,
  StyledFilterActionLink,
  StyledFilterActions,
  StyledFilterDeleteButton,
  StyledFilterHeader,
  StyledFilterHeaderLeft,
  StyledFilterHeaderTitle,
  StyledSearchInput,
} from "../styled-components"

import OperatorSelector from "./OperatorSelector"

const SEARCH_THRESHOLD = 5

function isNullOperator(op: string): boolean {
  return op === "is_null" || op === "is_not_null"
}

interface MultiselectFilterProps {
  columnName: string
  options: string[]
  displayOptions?: string[]
  selectedValues: string[]
  operators: string[]
  currentOperator: string
  onOperatorChange: (operator: string) => void
  onToggleValue: (value: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onDelete: () => void
  disabled: boolean
}

function MultiselectFilter({
  columnName,
  options,
  displayOptions,
  selectedValues,
  operators,
  currentOperator,
  onOperatorChange,
  onToggleValue,
  onSelectAll,
  onClearAll,
  onDelete,
  disabled,
}: Readonly<MultiselectFilterProps>): ReactElement {
  const [search, setSearch] = useState("")

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])

  const displayMap = useMemo(() => {
    if (displayOptions?.length !== options.length) return null
    const map = new Map<string, string>()
    for (let i = 0; i < options.length; i++) {
      map.set(options[i], displayOptions[i])
    }
    return map
  }, [options, displayOptions])

  const getDisplayLabel = useCallback(
    (value: string): string => {
      return displayMap?.get(value) ?? value
    },
    [displayMap]
  )

  const filteredOptions = useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter(opt => {
      const display = getDisplayLabel(opt)
      return (
        opt.toLowerCase().includes(lower) ||
        display.toLowerCase().includes(lower)
      )
    })
  }, [options, search, getDisplayLabel])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setSearch(e.target.value)
    },
    []
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

      {!isNullOperator(currentOperator) && (
        <>
          {options.length > SEARCH_THRESHOLD && (
            <StyledSearchInput
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search..."
              aria-label={`Search ${columnName} options`}
            />
          )}

          <StyledCheckboxList>
            {filteredOptions.map(option => {
              const isChecked = selectedSet.has(option)
              return (
                <StyledCheckboxItem key={option}>
                  <StyledCheckboxInput
                    type="checkbox"
                    checked={isChecked}
                    onChange={(): void => {
                      if (!disabled) {
                        onToggleValue(option)
                      }
                    }}
                    disabled={disabled}
                    aria-label={option}
                  />
                  <StyledCheckboxMark
                    aria-hidden="true"
                    data-checked={isChecked ? "true" : undefined}
                  >
                    {isChecked && (
                      <svg viewBox="0 0 10 8" aria-hidden="true">
                        <polyline points="1 4 4 7 9 1" />
                      </svg>
                    )}
                  </StyledCheckboxMark>
                  <StyledCheckboxLabel>
                    {getDisplayLabel(option)}
                  </StyledCheckboxLabel>
                </StyledCheckboxItem>
              )
            })}
            {filteredOptions.length === 0 && (
              <StyledEmptyMessage>No options found</StyledEmptyMessage>
            )}
          </StyledCheckboxList>

          <StyledFilterActions>
            <StyledFilterActionLink type="button" onClick={onSelectAll}>
              Select all
            </StyledFilterActionLink>
            <StyledFilterActionLink type="button" onClick={onClearAll}>
              Clear
            </StyledFilterActionLink>
          </StyledFilterActions>
        </>
      )}
    </div>
  )
}

export default memo(MultiselectFilter)
