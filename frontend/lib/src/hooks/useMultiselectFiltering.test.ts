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

import {
  SELECT_ALL_ALWAYS,
  SELECT_ALL_DEFAULT_THRESHOLD,
  shouldShowBulkAction,
} from "./useMultiselectFiltering"

describe("shouldShowBulkAction", () => {
  it.each([
    { selectAll: SELECT_ALL_ALWAYS, selectableCount: 2, expected: true },
    { selectAll: SELECT_ALL_ALWAYS, selectableCount: 1, expected: false },
    { selectAll: SELECT_ALL_ALWAYS, selectableCount: 5000, expected: true },
    { selectAll: 0, selectableCount: 10, expected: false },
    { selectAll: 1, selectableCount: 2, expected: false },
    { selectAll: 2, selectableCount: 2, expected: true },
    { selectAll: 2, selectableCount: 3, expected: false },
    {
      selectAll: SELECT_ALL_DEFAULT_THRESHOLD,
      selectableCount: 1000,
      expected: true,
    },
    {
      selectAll: SELECT_ALL_DEFAULT_THRESHOLD,
      selectableCount: 1001,
      expected: false,
    },
    { selectAll: undefined, selectableCount: 1000, expected: true },
    { selectAll: undefined, selectableCount: 1001, expected: false },
  ])(
    "selectAll=$selectAll selectableCount=$selectableCount → $expected",
    ({ selectAll, selectableCount, expected }) => {
      expect(shouldShowBulkAction(selectableCount, selectAll)).toBe(expected)
    }
  )
})
