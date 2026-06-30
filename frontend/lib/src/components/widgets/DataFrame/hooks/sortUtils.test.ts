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

import { describe, expect, it } from "vitest"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

import {
  ActiveColumnSort,
  applySortIndicator,
  getNextColumnSort,
} from "./sortUtils"

describe("getNextColumnSort", () => {
  it("starts ascending for an unsorted column with auto", () => {
    expect(getNextColumnSort(undefined, "a", "auto")).toEqual({
      columnId: "a",
      direction: "asc",
    })
  })

  it("toggles asc -> desc -> none with auto on the same column", () => {
    const asc: ActiveColumnSort = { columnId: "a", direction: "asc" }
    expect(getNextColumnSort(asc, "a", "auto")).toEqual({
      columnId: "a",
      direction: "desc",
    })
    const desc: ActiveColumnSort = { columnId: "a", direction: "desc" }
    expect(getNextColumnSort(desc, "a", "auto")).toBeUndefined()
  })

  it("starts ascending with auto when a different column was sorted", () => {
    const current: ActiveColumnSort = { columnId: "a", direction: "desc" }
    expect(getNextColumnSort(current, "b", "auto")).toEqual({
      columnId: "b",
      direction: "asc",
    })
  })

  it("applies an explicit direction directly", () => {
    expect(getNextColumnSort(undefined, "a", "desc")).toEqual({
      columnId: "a",
      direction: "desc",
    })
  })

  it("clears the sort with autoReset when the direction is unchanged", () => {
    const current: ActiveColumnSort = { columnId: "a", direction: "asc" }
    expect(getNextColumnSort(current, "a", "asc", true)).toBeUndefined()
  })

  it("keeps the sort with autoReset when the direction changes", () => {
    const current: ActiveColumnSort = { columnId: "a", direction: "asc" }
    expect(getNextColumnSort(current, "a", "desc", true)).toEqual({
      columnId: "a",
      direction: "desc",
    })
  })

  it("removes the sort when direction is undefined", () => {
    const current: ActiveColumnSort = { columnId: "a", direction: "asc" }
    expect(getNextColumnSort(current, "a", undefined)).toBeUndefined()
  })
})

describe("applySortIndicator", () => {
  const columns = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
  ] as BaseColumn[]

  it("returns columns unchanged when there is no active sort", () => {
    expect(applySortIndicator(columns, undefined)).toBe(columns)
  })

  it("prefixes the active column title with an ascending arrow", () => {
    const result = applySortIndicator(columns, {
      columnId: "a",
      direction: "asc",
    })
    expect(result[0].title).toBe("↑ A")
    expect(result[1].title).toBe("B")
  })

  it("prefixes the active column title with a descending arrow", () => {
    const result = applySortIndicator(columns, {
      columnId: "b",
      direction: "desc",
    })
    expect(result[0].title).toBe("A")
    expect(result[1].title).toBe("↓ B")
  })
})
