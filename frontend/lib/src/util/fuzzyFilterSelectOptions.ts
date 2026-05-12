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

import { sortBy } from "lodash-es"

import { streamlit } from "@streamlit/protobuf"

import { hasMatch, score } from "~lib/vendor/fzy.js/fuzzySearch"

interface LabeledOption {
  label: string
  value: string
}

const normalizeFilterValue = (value: string): string => value.toLowerCase()
export function getSelectFilterMode(
  filterMode?: streamlit.SelectWidgetFilterMode | null
): streamlit.SelectWidgetFilterMode {
  return filterMode ?? streamlit.SelectWidgetFilterMode.FILTER_MODE_FUZZY
}

// Add a custom filterOptions method to filter options only based on labels.
// The baseweb default method filters based on labels or indices
// More details: https://github.com/streamlit/streamlit/issues/1010
// Also filters using fuzzy search.
export function fuzzyFilterSelectOptions<T extends LabeledOption>(
  options: readonly T[],
  pattern: string
): readonly T[] {
  if (!pattern) {
    return options
  }

  const filteredOptions = options.filter((opt: T) =>
    hasMatch(pattern, opt.label)
  )
  return sortBy(
    filteredOptions,
    // Use the negative score to sort the list in a stable manner
    // This ensures highest score is first
    (opt: T) => -score(pattern, opt.label)
  )
}

export function filterSelectOptions<T extends LabeledOption>(
  options: readonly T[],
  pattern: string,
  filterMode: streamlit.SelectWidgetFilterMode
): readonly T[] {
  if (
    !pattern ||
    filterMode === streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE
  ) {
    return options
  }

  if (filterMode === streamlit.SelectWidgetFilterMode.FILTER_MODE_FUZZY) {
    return fuzzyFilterSelectOptions(options, pattern)
  }

  const normalizedPattern = normalizeFilterValue(pattern)

  if (filterMode === streamlit.SelectWidgetFilterMode.FILTER_MODE_CONTAINS) {
    return options.filter((opt: T) =>
      normalizeFilterValue(opt.label).includes(normalizedPattern)
    )
  }

  if (filterMode === streamlit.SelectWidgetFilterMode.FILTER_MODE_PREFIX) {
    return options.filter((opt: T) =>
      normalizeFilterValue(opt.label).startsWith(normalizedPattern)
    )
  }

  return options
}
