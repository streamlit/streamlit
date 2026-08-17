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

import { memo, type ReactElement } from "react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"

import {
  StyledFilterDeleteButton,
  StyledFilterHeader,
  StyledFilterHeaderLeft,
  StyledFilterHeaderTitle,
  StyledToggleGroup,
  StyledToggleOption,
} from "../styled-components"

import OperatorSelector from "./OperatorSelector"

interface ToggleFilterProps {
  columnName: string
  currentValue: boolean | null
  operators: string[]
  currentOperator: string
  onOperatorChange: (operator: string) => void
  onChange: (value: boolean | null) => void
  onDelete: () => void
  disabled: boolean
}

function ToggleFilter({
  columnName,
  currentValue,
  operators,
  currentOperator,
  onOperatorChange,
  onChange,
  onDelete,
  disabled,
}: Readonly<ToggleFilterProps>): ReactElement {
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

      <StyledToggleGroup role="group" aria-label={`${columnName} toggle`}>
        <StyledToggleOption
          $isSelected={currentValue === null}
          onClick={(): void => onChange(null)}
          disabled={disabled}
          aria-pressed={currentValue === null}
        >
          All
        </StyledToggleOption>
        <StyledToggleOption
          $isSelected={currentValue === true}
          onClick={(): void => onChange(currentValue === true ? null : true)}
          disabled={disabled}
          aria-pressed={currentValue === true}
        >
          True
        </StyledToggleOption>
        <StyledToggleOption
          $isSelected={currentValue === false}
          onClick={(): void => onChange(currentValue === false ? null : false)}
          disabled={disabled}
          aria-pressed={currentValue === false}
        >
          False
        </StyledToggleOption>
      </StyledToggleGroup>
    </div>
  )
}

export default memo(ToggleFilter)
