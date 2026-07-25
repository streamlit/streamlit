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

import { useMemo } from "react"

import { streamlit } from "@streamlit/protobuf"

import {
  filterSelectOptions,
  getSelectFilterMode,
} from "~lib/util/fuzzyFilterSelectOptions"

export const SELECT_ALL_ID = "__select_all__"
export const SELECT_MATCHES_ID = "__select_matches__"
export const CREATABLE_ID = "__creatable__"

/**
 * Threshold at or above which "Select all" / "Select X matches" is disabled.
 * Selecting all items at once with very large option lists causes
 * severe performance issues (browser freezes, large serialization payloads).
 */
const SELECT_ALL_THRESHOLD = 1000

export interface MultiselectOption {
  id: string
  label: string
  value: string
  isBulkAction?: boolean
  isCreatable?: boolean
}

interface UseMultiselectFilteringProps {
  options: string[]
  selectedValues: string[]
  inputValue: string
  filterActive: boolean
  filterMode?: streamlit.SelectWidgetFilterMode | null
  acceptNewOptions: boolean
  maxSelections: number
}

interface UseMultiselectFilteringResult {
  displayOptions: MultiselectOption[]
  resolvedFilterMode: streamlit.SelectWidgetFilterMode
}

export function useMultiselectFiltering({
  options,
  selectedValues,
  inputValue,
  filterActive,
  filterMode: filterModeProp,
  acceptNewOptions,
  maxSelections,
}: UseMultiselectFilteringProps): UseMultiselectFilteringResult {
  const resolvedFilterMode = useMemo(
    () => getSelectFilterMode(filterModeProp),
    [filterModeProp]
  )

  const overMaxSelections =
    maxSelections > 0 && selectedValues.length >= maxSelections

  const selectOptions = useMemo<MultiselectOption[]>(
    () =>
      options.map((opt, i) => ({
        id: String(i),
        label: opt,
        value: opt,
      })),
    [options]
  )

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])

  const unselectedOptions = useMemo<MultiselectOption[]>(
    () => selectOptions.filter(o => !selectedSet.has(o.value)),
    [selectOptions, selectedSet]
  )

  const filteredOptions = useMemo((): MultiselectOption[] => {
    if (overMaxSelections) return []
    if (!filterActive || !inputValue) return unselectedOptions
    return filterSelectOptions(
      unselectedOptions,
      inputValue,
      resolvedFilterMode
    ) as MultiselectOption[]
  }, [
    unselectedOptions,
    inputValue,
    resolvedFilterMode,
    filterActive,
    overMaxSelections,
  ])

  const displayOptions = useMemo((): MultiselectOption[] => {
    if (overMaxSelections) return []

    const result: MultiselectOption[] = []

    // "Select all" / "Select X matches" pseudo-option
    if (filteredOptions.length > 1 && options.length < SELECT_ALL_THRESHOLD) {
      if (filterActive && inputValue.trim()) {
        result.push({
          id: SELECT_MATCHES_ID,
          label: `Select ${filteredOptions.length} matches`,
          value: SELECT_MATCHES_ID,
          isBulkAction: true,
        })
      } else {
        result.push({
          id: SELECT_ALL_ID,
          label: "Select all",
          value: SELECT_ALL_ID,
          isBulkAction: true,
        })
      }
    }

    result.push(...filteredOptions)

    // "Add: ..." creatable pseudo-option
    if (acceptNewOptions && filterActive && inputValue) {
      const exactMatch = options.some(o => o === inputValue)
      if (!exactMatch) {
        result.push({
          id: CREATABLE_ID,
          label: `Add: ${inputValue}`,
          value: CREATABLE_ID,
          isCreatable: true,
        })
      }
    }

    return result
  }, [
    filteredOptions,
    options,
    filterActive,
    inputValue,
    acceptNewOptions,
    overMaxSelections,
  ])

  return { displayOptions, resolvedFilterMode }
}
