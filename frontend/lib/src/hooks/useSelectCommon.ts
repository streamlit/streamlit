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

import { useMemo } from "react"

import { type Option } from "baseui/select"

import { fuzzyFilterSelectOptions } from "~lib/util/fuzzyFilterSelectOptions"
import { isMobile } from "~lib/util/isMobile"
import { getSelectPlaceholder, isNullOrUndefined } from "~lib/util/utils"

export interface SelectOption {
  label: string
  value: string
  id: string
}

export interface UseSelectCommonArgs {
  options: string[]
  isMulti: boolean
  acceptNewOptions: boolean
  placeholderInput: string
  maxSelections?: number
}

export interface UseSelectCommonResult {
  selectOptions: SelectOption[]
  placeholder: string
  disabled: boolean
  inputReadOnly: "readonly" | null
  valueToUiSingle: (value: string | null) => Option[]
  valuesToUiMulti: (values: string[]) => Option[]
  createFilterOptions: (
    selectedValues?: string[]
  ) => (options: readonly Option[], filterValue: string) => readonly Option[]
}

export function useSelectCommon(
  args: UseSelectCommonArgs
): UseSelectCommonResult {
  const { options, isMulti, acceptNewOptions, placeholderInput } = args

  const selectOptions: SelectOption[] = useMemo(
    () =>
      options.map((option: string, index: number) => ({
        label: option,
        value: option,
        // We are using an id because if multiple options are equal,
        // we have observed weird UI glitches
        id: `${option}_${index}`,
      })),
    [options]
  )

  // Get placeholder and disabled state using utility function
  const { placeholder, shouldDisable } = useMemo(
    () =>
      getSelectPlaceholder(
        placeholderInput,
        options,
        acceptNewOptions,
        isMulti
      ),
    [acceptNewOptions, isMulti, options, placeholderInput]
  )

  const showKeyboardOnMobile = options.length > 10

  const inputReadOnly =
    isMobile() && !showKeyboardOnMobile && !acceptNewOptions
      ? "readonly"
      : null

  const valueToUiSingle = useMemo(
    () =>
      (value: string | null): Option[] => {
        if (isNullOrUndefined(value)) return []
        return [{ label: value, value }]
      },
    []
  )

  const valuesToUiMulti = useMemo(
    () =>
      (values: string[]): Option[] =>
        values.map(v => ({ label: v, value: v })),
    []
  )

  const createFilterOptions = useMemo(
    () =>
      (selectedValues?: string[]) =>
      (
        optionsList: readonly Option[],
        filterValue: string
      ): readonly Option[] => {
        const base = Array.isArray(selectedValues)
          ? // We need to manually filter for previously selected options here
            optionsList.filter(opt => !selectedValues.includes(opt.value))
          : optionsList

        return fuzzyFilterSelectOptions(
          base as { label: string; value: string }[],
          filterValue
        )
      },
    []
  )

  return {
    selectOptions,
    placeholder,
    disabled: shouldDisable,
    inputReadOnly,
    valueToUiSingle,
    valuesToUiMulti,
    createFilterOptions,
  }
}
