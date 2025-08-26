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

import sortBy from "lodash/sortBy"

import { hasMatch, score } from "~lib/vendor/fzy.js/fuzzySearch"

export interface LabeledOption {
  label: string
  value: string
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
    (opt: T) => -score(pattern, opt.label, true)
  )
}
