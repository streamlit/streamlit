/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { renderHook } from "@testing-library/react-hooks"

import { Quiver } from "src/lib/dataframes/Quiver"
import { Arrow as ArrowProto } from "src/lib/proto"
import { UNICODE } from "src/lib/mocks/arrow"
import {
  BaseColumn,
  ObjectColumn,
  TextColumn,
  BooleanColumn,
  CategoricalColumn,
  ListColumn,
  NumberColumn,
  ColumnCreator,
} from "src/lib/components/widgets/DataFrame/columns"

import useColumnLoader, {
  ColumnConfigProps,
  applyColumnConfig,
  getColumnConfig,
  getColumnType,
  INDEX_IDENTIFIER,
  COLUMN_POSITION_PREFIX,
  COLUMN_WIDTH_MAPPING,
} from "./useColumnLoader"

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "index_col",
    name: "",
    title: "",
    indexNumber: 0,
    arrowType: {
      pandas_type: "int64",
      numpy_type: "int64",
    },
    isEditable: false,
    isHidden: false,
    isIndex: true,
    isStretched: false,
  }),
  NumberColumn({
    id: "column_1",
    name: "column_1",
    title: "column_1",
    indexNumber: 1,
    arrowType: {
      pandas_type: "int64",
      numpy_type: "int64",
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    name: "column_2",
    title: "column_2",
    indexNumber: 2,
    arrowType: {
      pandas_type: "unicode",
      numpy_type: "object",
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isStretched: false,
  }),
]

describe("applyColumnConfig", () => {
  it("should correctly apply the use-defined column config", () => {
    const columnConfig: Map<string | number, ColumnConfigProps> = new Map([
      [
        "column_1",
        {
          width: "small",
          disabled: false,
          type: "text",
        } as ColumnConfigProps,
      ],
      [
        "column_2",
        {
          disabled: true,
          hidden: true,
          alignment: "center",
          required: true,
          default: "this is the default",
        } as ColumnConfigProps,
      ],
    ])

    const column1 = applyColumnConfig(MOCK_COLUMNS[1], columnConfig)
    expect(column1.isEditable).toBe(true)
    expect(column1.width).toBe(COLUMN_WIDTH_MAPPING.small)
    expect(column1.customType).toBe("text")
    expect(column1).toEqual({
      ...MOCK_COLUMNS[1],
      width: COLUMN_WIDTH_MAPPING.small,
      isEditable: true,
      customType: "text",
    })

    const column2 = applyColumnConfig(MOCK_COLUMNS[2], columnConfig)
    expect(column2.isEditable).toBe(false)
    expect(column2.width).toBe(undefined)
    expect(column2.contentAlignment).toBe("center")
    expect(column2.isHidden).toBe(true)
    expect(column2.isRequired).toBe(true)
    expect(column2.defaultValue).toBe("this is the default")
    expect(column2).toEqual({
      ...MOCK_COLUMNS[2],
      isHidden: true,
      contentAlignment: "center",
      defaultValue: "this is the default",
      isRequired: true,
    })
  })

  it("allows configuring the index via `index` as ID", () => {
    const columnConfig: Map<string | number, ColumnConfigProps> = new Map([
      [
        INDEX_IDENTIFIER,
        {
          width: "small",
        },
      ],
    ])

    const column1 = applyColumnConfig(MOCK_COLUMNS[0], columnConfig)
    expect(column1.width).toBe(COLUMN_WIDTH_MAPPING.small)
    expect(column1.isIndex).toBe(true)

    const column2 = applyColumnConfig(MOCK_COLUMNS[1], columnConfig)
    expect(column2.width).toBe(undefined)
    expect(column2.isIndex).toBe(false)
  })

  it("allows configuring a column via numeric ID", () => {
    const columnConfig: Map<string | number, ColumnConfigProps> = new Map([
      [
        `${COLUMN_POSITION_PREFIX}0`,
        {
          width: "small",
        },
      ],
    ])

    const column1 = applyColumnConfig(MOCK_COLUMNS[0], columnConfig)
    expect(column1.width).toBe(COLUMN_WIDTH_MAPPING.small)
  })

  it("works with empty column configs", () => {
    const emptyColumnConfig: Map<string | number, ColumnConfigProps> = new Map(
      []
    )

    const column1 = applyColumnConfig(MOCK_COLUMNS[0], emptyColumnConfig)
    expect(column1).toBe(MOCK_COLUMNS[0])
  })
})

describe("getColumnConfig", () => {
  it("extract the column config from the proto element", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      columns: JSON.stringify({
        c1: {
          width: "small",
          hidden: true,
        },
        c2: {
          width: "medium",
          alignment: "center",
        },
      }),
    })

    const columnConfig = getColumnConfig(element)
    expect(columnConfig.size).toBe(2)
    expect(columnConfig.get("c1")).toEqual({
      width: "small",
      hidden: true,
    })
    expect(columnConfig.get("c2")).toEqual({
      width: "medium",
      alignment: "center",
    })
  })
})

describe("getColumnType", () => {
  it("determines the correct column type creator", () => {
    const column1 = getColumnType(MOCK_COLUMNS[1])
    expect(column1).toBe(NumberColumn)

    const column2 = getColumnType(MOCK_COLUMNS[2])
    expect(column2).toBe(TextColumn)
  })

  it.each([
    ["object", ObjectColumn],
    ["text", TextColumn],
    ["boolean", BooleanColumn],
    ["categorical", CategoricalColumn],
    ["list", ListColumn],
    ["number", NumberColumn],
  ])(
    "maps user-specified type to column type (%p parsed as %p)",
    (typeName: string, columnCreator: ColumnCreator) => {
      const columnType = getColumnType({
        id: "column_1",
        name: "column_1",
        title: "column_1",
        indexNumber: 1,
        arrowType: {
          pandas_type: "int64",
          numpy_type: "int64",
        },
        isEditable: false,
        isHidden: false,
        isIndex: false,
        isStretched: false,
        customType: typeName,
      })
      expect(columnType).toEqual(columnCreator)
    }
  )
})

describe("useColumnLoader hook", () => {
  it("creates columns from the Arrow data", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false)
    })

    const { columns } = result.current

    expect(columns.length).toBe(3)

    expect(columns[0].title).toBe("")
    expect(columns[0].isIndex).toBe(true)

    expect(columns[1].title).toBe("c1")
    expect(columns[1].isIndex).toBe(false)

    expect(columns[2].title).toBe("c2")
    expect(columns[2].isIndex).toBe(false)
  })

  it("activates colum stretch if configured by user", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: true,
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false)
    })

    for (const column of result.current.columns) {
      expect(column.isStretched).toBe(true)
    }
  })

  it("configures the editable icon for editable columns", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: true,
      editingMode: ArrowProto.EditingMode.FIXED,
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false)
    })

    for (const column of result.current.columns) {
      expect(column.icon).toBe("editable")
    }
  })

  it("doesn't configure any icon for non-editable columns", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: true,
      editingMode: ArrowProto.EditingMode.READ_ONLY,
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false)
    })

    for (const column of result.current.columns) {
      expect(column.icon).toBe(undefined)
    }
  })
})
