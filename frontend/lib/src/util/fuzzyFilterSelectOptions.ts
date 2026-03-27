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

type SelectFilterMode = "fuzzy" | "contains" | "prefix" | "none"

const normalizeFilterValue = (value: string): string => value.toLowerCase()
const PROTO_SELECT_FILTER_MODE_MAP: Record<
  streamlit.SelectWidgetFilterMode,
  SelectFilterMode
> = {
  [streamlit.SelectWidgetFilterMode.FILTER_MODE_FUZZY]: "fuzzy",
  [streamlit.SelectWidgetFilterMode.FILTER_MODE_CONTAINS]: "contains",
  [streamlit.SelectWidgetFilterMode.FILTER_MODE_PREFIX]: "prefix",
  [streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE]: "none",
} as const

export function normalizeSelectFilterMode(
  filterMode?: streamlit.SelectWidgetFilterMode | string | null
): SelectFilterMode {
  if (filterMode === null || filterMode === undefined) {
    return "fuzzy"
  }

  if (typeof filterMode === "number") {
    return PROTO_SELECT_FILTER_MODE_MAP[filterMode] ?? "fuzzy"
  }

  switch (filterMode) {
    case "contains":
    case "prefix":
    case "none":
      return filterMode
    default:
      return "fuzzy"
  }
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
  filterMode: SelectFilterMode
): readonly T[] {
  if (!pattern || filterMode === "none") {
    return options
  }

  if (filterMode === "fuzzy") {
    return fuzzyFilterSelectOptions(options, pattern)
  }

  const normalizedPattern = normalizeFilterValue(pattern)

  return options.filter((opt: T) => {
    const normalizedLabel = normalizeFilterValue(opt.label)

    if (filterMode === "contains") {
      return normalizedLabel.includes(normalizedPattern)
    }

    return normalizedLabel.startsWith(normalizedPattern)
  })
}
