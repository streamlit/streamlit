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

import { Field, Int64, List, Struct, Utf8 } from "apache-arrow"
import { describe, expect, it } from "vitest"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { ArrowType, DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import {
  ActiveColumnSort,
  applySortIndicator,
  getNextColumnSort,
  isServerSortableColumn,
} from "./sortUtils"

/** Build a minimal column carrying only the fields the predicate reads. */
function makeColumn(
  name: string,
  arrowField: Field,
  pandasTypeName = "unicode",
  numpyTypeName = "object"
): BaseColumn {
  const arrowType: ArrowType = {
    type: DataFrameCellType.DATA,
    arrowField,
    pandasType: {
      field_name: arrowField.name,
      name: arrowField.name,
      pandas_type: pandasTypeName,
      numpy_type: numpyTypeName,
      metadata: null,
    },
  }
  return { name, arrowType } as BaseColumn
}

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

describe("isServerSortableColumn", () => {
  it("allows a named column with an orderable numeric type", () => {
    const column = makeColumn(
      "num",
      new Field("num", new Int64(), true),
      "int64",
      "int64"
    )
    expect(isServerSortableColumn(column)).toBe(true)
  })

  it("allows a named column with an orderable string type", () => {
    const column = makeColumn("str", new Field("str", new Utf8(), true))
    expect(isServerSortableColumn(column)).toBe(true)
  })

  it("rejects the index column (empty backend field name)", () => {
    const column = makeColumn(
      "",
      new Field("index", new Int64(), true),
      "int64",
      "int64"
    )
    expect(isServerSortableColumn(column)).toBe(false)
  })

  it("rejects an unorderable list column", () => {
    const column = makeColumn(
      "list_col",
      new Field(
        "list_col",
        new List(new Field("item", new Int64(), true)),
        true
      ),
      "list[int64]"
    )
    expect(isServerSortableColumn(column)).toBe(false)
  })

  it("rejects an unorderable struct column", () => {
    const column = makeColumn(
      "struct_col",
      new Field(
        "struct_col",
        new Struct([new Field("x", new Int64(), true)]),
        true
      ),
      "object",
      "object"
    )
    expect(isServerSortableColumn(column)).toBe(false)
  })

  it("rejects a column whose pandas type resolves to a generic object", () => {
    const column = makeColumn(
      "obj",
      new Field("obj", new Utf8(), true),
      "object",
      "object"
    )
    expect(isServerSortableColumn(column)).toBe(false)
  })
})
