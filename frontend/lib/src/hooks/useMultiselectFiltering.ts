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

/**
 * Threshold at or above which "Select all" / "Select X matches" is disabled.
 * Selecting all items with very large option lists causes browser freezes.
 * See: https://github.com/streamlit/streamlit/issues/15299
 */
const SELECT_ALL_THRESHOLD = 1000

/** Stable ID for the "Select all" pseudo-option. */
export const MULTISELECT_SELECT_ALL_ID = "__SELECT_ALL__"

/** Stable ID for the "Select X matches" pseudo-option. */
export const MULTISELECT_SELECT_MATCHES_ID = "__SELECT_MATCHES__"

/** Stable ID for the creatable "Add: …" pseudo-option. */
export const MULTISELECT_CREATABLE_ID = "__creatable__"

type ComboOption = {
  id: string
  label: string
  value: string
  isCreatable?: boolean
  isSelectAll?: boolean
}

export interface UseMultiselectFilteringArgs {
  /** All available option strings from the proto. */
  options: string[]
  /** Current input text (from user typing in the filter input). */
  inputValue: string
  /** Currently selected string values. */
  selectedValues: string[]
  /**
   * True when the user is actively typing. When false (dropdown just opened
   * without typing) the full unfiltered list is shown.
   */
  filterActive: boolean
  /** Filter mode from the proto, defaults to FUZZY when absent. */
  filterMode?: streamlit.SelectWidgetFilterMode | null
  /** When true a "creatable" Add option is appended when the typed text has no exact match. */
  acceptNewOptions?: boolean
}

export interface UseMultiselectFilteringResult {
  /**
   * The options to display in the ListBox (excluding already-selected ones),
   * ordered for display. Includes pseudo-items if applicable.
   */
  displayOptions: ComboOption[]
  /**
   * The values matched by the current filter query, used when "Select X
   * matches" is clicked. Stored as a ref-friendly array (stable reference
   * between renders unless the filtered set actually changes).
   */
  selectMatchesValues: string[]
}

/**
 * Derives the filtered option list and bulk-selection items for a
 * multi-select ComboBox.
 *
 * Responsibilities:
 * - Map `options` to `ComboOption[]` (id, label, value).
 * - Exclude already-selected values from the base list.
 * - Apply the configured filter mode to the remaining options.
 * - Prepend "Select all" (no search) or "Select X matches" (with search)
 *   when the filtered count > 1 and below the safety threshold.
 * - Append a creatable "Add: …" option when `acceptNewOptions` is set and
 *   the typed text has no exact match in all options.
 */
export function useMultiselectFiltering({
  options,
  inputValue,
  selectedValues,
  filterActive,
  filterMode: filterModeProp,
  acceptNewOptions,
}: UseMultiselectFilteringArgs): UseMultiselectFilteringResult {
  const filterMode = getSelectFilterMode(filterModeProp)

  return useMemo(() => {
    // Build labeled options for all values, using index-namespaced IDs to
    // avoid collisions when two options share the same string value.
    const allOptions: ComboOption[] = options.map((opt, idx) => ({
      id: `${opt}_${idx}`,
      label: opt,
      value: opt,
    }))

    // Exclude already-selected values so they don't show in the dropdown.
    const unselectedOptions = allOptions.filter(
      o => !selectedValues.includes(o.value)
    )

    // Apply filtering only when the user has typed something.
    const filteredOptions: ComboOption[] =
      filterActive && inputValue.trim()
        ? (filterSelectOptions(
            unselectedOptions,
            inputValue,
            filterMode
          ) as ComboOption[])
        : unselectedOptions

    const hasSearch = filterActive && Boolean(inputValue.trim())
    const belowThreshold = options.length < SELECT_ALL_THRESHOLD
    const showBulk = filteredOptions.length > 1 && belowThreshold

    let selectMatchesValues: string[] = []
    const displayOptions: ComboOption[] = []

    if (showBulk) {
      if (hasSearch) {
        selectMatchesValues = filteredOptions.map(o => o.value)
        displayOptions.push({
          id: MULTISELECT_SELECT_MATCHES_ID,
          label: `Select ${filteredOptions.length} matches`,
          value: MULTISELECT_SELECT_MATCHES_ID,
          isSelectAll: true,
        })
      } else {
        displayOptions.push({
          id: MULTISELECT_SELECT_ALL_ID,
          label: "Select all",
          value: MULTISELECT_SELECT_ALL_ID,
          isSelectAll: true,
        })
      }
    }

    displayOptions.push(...filteredOptions)

    // Creatable option: only when user has typed something, the typed value
    // is not an exact match for ANY existing option (not just unselected ones),
    // and the value has not already been selected (prevents duplicates).
    if (acceptNewOptions && filterActive && inputValue.trim()) {
      const exactMatch =
        options.some(o => o === inputValue) ||
        selectedValues.includes(inputValue.trim())
      if (!exactMatch) {
        displayOptions.push({
          id: MULTISELECT_CREATABLE_ID,
          label: `Add: ${inputValue}`,
          value: inputValue,
          isCreatable: true,
        })
      }
    }

    return { displayOptions, selectMatchesValues }
  }, [
    options,
    inputValue,
    selectedValues,
    filterActive,
    filterMode,
    acceptNewOptions,
  ])
}
