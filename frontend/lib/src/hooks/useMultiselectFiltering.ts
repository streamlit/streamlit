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

/** Sentinel for Python `select_all=True`: always show the bulk action. */
export const SELECT_ALL_ALWAYS = -1
/**
 * Threshold used when the proto field is unset (legacy messages). Bulk-selecting
 * more than this many options at once can freeze the browser and produce very
 * large widget-state payloads.
 */
export const SELECT_ALL_DEFAULT_THRESHOLD = 1000

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
  selectAll?: number | null
}

interface UseMultiselectFilteringResult {
  displayOptions: MultiselectOption[]
  resolvedFilterMode: streamlit.SelectWidgetFilterMode
}

/**
 * Whether the dropdown should include "Select all" / "Select X matches".
 *
 * `selectAll` is the encoded proto value:
 * - `-1`: always show when 2+ options are selectable
 * - `0`: never show
 * - `>0`: show when 2+ selectable options are at or below this threshold
 * - `null`/`undefined`: use `SELECT_ALL_DEFAULT_THRESHOLD` (legacy messages)
 */
export function shouldShowBulkAction(
  selectableCount: number,
  selectAll?: number | null
): boolean {
  if (selectableCount < 2) {
    return false
  }
  const threshold = selectAll ?? SELECT_ALL_DEFAULT_THRESHOLD
  if (threshold === SELECT_ALL_ALWAYS) {
    return true
  }
  return threshold > 0 && selectableCount <= threshold
}

/** Computes the filtered and decorated option list including bulk actions and creatable entries. */
export function useMultiselectFiltering({
  options,
  selectedValues,
  inputValue,
  filterActive,
  filterMode: filterModeProp,
  acceptNewOptions,
  maxSelections,
  selectAll,
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

    if (shouldShowBulkAction(filteredOptions.length, selectAll)) {
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

    // Allow the user to create a new option when the input doesn't match an existing one.
    if (acceptNewOptions && filterActive && inputValue) {
      const alreadyExists =
        options.some(o => o === inputValue) ||
        selectedValues.includes(inputValue)
      if (!alreadyExists) {
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
    selectedValues,
    filterActive,
    inputValue,
    acceptNewOptions,
    overMaxSelections,
    selectAll,
  ])

  return { displayOptions, resolvedFilterMode }
}
