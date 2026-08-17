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

import {
  StyledFilterDeleteButton,
  StyledFilterHeader,
  StyledFilterHeaderLeft,
  StyledFilterHeaderTitle,
  StyledSearchInput,
} from "../styled-components"

import OperatorSelector from "./OperatorSelector"

interface TextFilterProps {
  columnName: string
  operators: string[]
  currentOperator: string
  currentQuery: string
  onChange: (operator: string, query: string) => void
  onDelete: () => void
  disabled: boolean
}

function isNullOperator(op: string): boolean {
  return op === "is_null" || op === "is_not_null"
}

function TextFilter({
  columnName,
  operators,
  currentOperator,
  currentQuery,
  onChange,
  onDelete,
  disabled,
}: Readonly<TextFilterProps>): ReactElement {
  const [localQuery, setLocalQuery] = useState(currentQuery)

  const handleOperatorChange = useCallback(
    (operator: string): void => {
      onChange(operator, isNullOperator(operator) ? "" : localQuery)
    },
    [onChange, localQuery]
  )

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const newQuery = e.target.value
      setLocalQuery(newQuery)
      onChange(currentOperator, newQuery)
    },
    [onChange, currentOperator]
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
              onChange={handleOperatorChange}
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
        <StyledSearchInput
          type="text"
          value={localQuery}
          onChange={handleQueryChange}
          placeholder={`Enter text...`}
          aria-label={`${columnName} text filter value`}
          disabled={disabled}
        />
      )}
    </div>
  )
}

export default memo(TextFilter)
