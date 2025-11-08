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

import { renderHook } from "@testing-library/react"
import { Field, Int64, Utf8 } from "apache-arrow"

import { Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

import {
  BaseColumn,
  CheckboxColumn,
  ColumnCreator,
  ListColumn,
  NumberColumn,
  ObjectColumn,
  SelectboxColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { UNICODE } from "~lib/mocks/arrow"

import useColumnLoader, {
  applyColumnConfig,
  COLUMN_POSITION_PREFIX,
  COLUMN_WIDTH_MAPPING,
  ColumnConfigProps,
  getColumnConfig,
  getColumnType,
  INDEX_IDENTIFIER,
} from "./useColumnLoader"

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "index_col",
    name: "",
    title: "",
    indexNumber: 0,
    arrowType: {
      type: DataFrameCellType.INDEX,
      arrowField: new Field("index_col", new Int64(), true),
      pandasType: {
        field_name: "index_col",
        name: "index_col",
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: true,
    isPinned: true,
    isStretched: false,
  }),
  NumberColumn({
    id: "column_1",
    name: "column_1",
    title: "column_1",
    indexNumber: 1,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_1", new Int64(), true),
      pandasType: {
        field_name: "column_1",
        name: "column_1",
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    name: "column_2",
    title: "column_2",
    indexNumber: 2,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_2", new Utf8(), true),
      pandasType: {
        field_name: "column_2",
        name: "column_2",
        pandas_type: "unicode",
        numpy_type: "object",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
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
          type_config: {
            type: "text",
          },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    expect((column1.columnTypeOptions as any).type).toBe("text")
    expect(column1).toEqual({
      ...MOCK_COLUMNS[1],
      width: COLUMN_WIDTH_MAPPING.small,
      isEditable: true,
      columnTypeOptions: {
        type: "text",
      },
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

  it("applies column config in the correct priority order", () => {
    const columnConfig: Map<string | number, ColumnConfigProps> = new Map([
      // All these column keys refer to the same column. They are just different
      // ways of specifying the same column (index, position, name, ID).
      // 1. Index config
      [
        INDEX_IDENTIFIER,
        {
          width: "small",
          label: "Index Label",
          alignment: "left",
        },
      ],
      // 2. Position-based config
      [
        `${COLUMN_POSITION_PREFIX}0`,
        {
          width: "medium",
          label: "Position Label",
          alignment: "center",
        },
      ],
      // 3. Name-based config
      [
        "",
        {
          width: "large",
          label: "Name Label",
          alignment: "right",
        },
      ],
      // 4. ID-based config
      [
        "index_col",
        {
          width: 100,
          label: "ID Label",
          alignment: "left",
        },
      ],
    ])

    // Test with the index column from MOCK_COLUMNS
    const result = applyColumnConfig(MOCK_COLUMNS[0], columnConfig)

    // Config should be merged in order, with later configs overwriting earlier ones
    expect(result).toEqual({
      ...MOCK_COLUMNS[0],
      // Should have the width from ID config (last)
      width: 100,
      // Should have the label from ID config (last)
      title: "ID Label",
      // Should have the alignment from ID config (last)
      contentAlignment: "left",
    })
  })

  it("allows partial config overrides in priority order", () => {
    const columnConfig: Map<string | number, ColumnConfigProps> = new Map([
      // All these column keys refer to the same column. They are just different
      // ways of specifying the same column (_index, position, ID).
      [
        INDEX_IDENTIFIER,
        {
          width: "small",
          label: "Index Label",
        },
      ],
      [
        `${COLUMN_POSITION_PREFIX}0`,
        {
          // Only override the label
          label: "Position Label",
        },
      ],
      [
        "index_col",
        {
          // Only override the width
          width: 100,
        },
      ],
    ])

    const result = applyColumnConfig(MOCK_COLUMNS[0], columnConfig)

    expect(result).toEqual({
      ...MOCK_COLUMNS[0],
      // Width should come from ID config
      width: 100,
      // Label should come from position config
      title: "Position Label",
    })
  })

  it("correctly merges nested type_config options", () => {
    const columnConfig: Map<string | number, ColumnConfigProps> = new Map([
      // All these column keys refer to the same column. They are just different
      // ways of specifying the same column (_index, position, ID).
      // 1. Index config
      [
        INDEX_IDENTIFIER,
        {
          type_config: {
            options: ["a", "b"],
            min_value: 0,
          },
        },
      ],
      // 2. Position-based config
      [
        `${COLUMN_POSITION_PREFIX}0`,
        {
          type_config: {
            options: ["c", "d", "x"],
            max_value: 100,
          },
        },
      ],
      // 3. ID-based config
      [
        "index_col",
        {
          type_config: {
            options: ["e", "f"],
            step: 1,
          },
        },
      ],
    ])

    const result = applyColumnConfig(MOCK_COLUMNS[0], columnConfig)

    // Should merge all type_config options from different config sources
    expect(result.columnTypeOptions).toEqual({
      options: ["e", "f"], // From ID config (last)
      min_value: 0, // From index config (first)
      max_value: 100, // From position config
      step: 1, // From ID config (last)
    })
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

    const columnConfig = getColumnConfig(element.columns)
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
    ["checkbox", CheckboxColumn],
    ["selectbox", SelectboxColumn],
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
          type: DataFrameCellType.DATA,
          arrowField: new Field("column_1", new Int64(), true),
          pandasType: {
            field_name: "column_1",
            name: "column_1",
            pandas_type: "int64",
            numpy_type: "int64",
            metadata: null,
          },
        },
        isEditable: false,
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
        columnTypeOptions: {
          type: typeName,
        },
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
      return useColumnLoader(element, data, false, element.columnOrder, null)
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

  it("reorders columns when specified via column order", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      columnOrder: ["c2", "c1"],
    })
    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    const { columns } = result.current

    expect(columns.length).toBe(3)

    expect(columns[0].title).toBe("")
    expect(columns[0].isIndex).toBe(true)

    expect(columns[1].title).toBe("c2")
    expect(columns[1].isIndex).toBe(false)

    expect(columns[2].title).toBe("c1")
    expect(columns[2].isIndex).toBe(false)
  })

  it("hides columns not specified in column order", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      columnOrder: ["c2"],
    })
    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    const { columns } = result.current

    expect(columns.length).toBe(2)

    expect(columns[0].title).toBe("")
    expect(columns[0].isIndex).toBe(true)

    expect(columns[1].title).toBe("c2")
    expect(columns[1].isIndex).toBe(false)
  })

  it("activates column stretch if configured by user", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: true,
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
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
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    for (const column of result.current.columns) {
      expect(column.icon).toBe("editable")
    }
  })

  it("disallows hidden for editable columns that are required for dynamic editing", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      editingMode: ArrowProto.EditingMode.DYNAMIC,
      columns: JSON.stringify({
        c1: {
          required: true,
          hidden: true,
        },
      }),
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    expect(result.current.columns[1].isRequired).toBe(true)
    expect(result.current.columns[1].isHidden).toBe(false)
  })

  it("respects hiding required columns for fixed editing", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      editingMode: ArrowProto.EditingMode.FIXED,
      columns: JSON.stringify({
        c1: {
          required: true,
          hidden: true,
        },
      }),
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    // Test that the column is hidden (not part of columns).
    // Column with index 1 should be c2:
    expect(result.current.columns[1].name).toBe("c2")
  })

  it("doesn't configure any icon for non-editable columns", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: true,
      editingMode: ArrowProto.EditingMode.READ_ONLY,
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    for (const column of result.current.columns) {
      expect(column.icon).toBe(undefined)
    }
  })

  it("uses column order to order pinned columns", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      columnOrder: ["c2", "c1"],
      columns: JSON.stringify({
        c1: {
          pinned: true,
        },
        c2: {
          pinned: true,
        },
      }),
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    // Range index:
    expect(result.current.columns[0].name).toBe("")
    expect(result.current.columns[0].isIndex).toBe(true)

    // Pinned columns:
    expect(result.current.columns[1].name).toBe("c2")
    expect(result.current.columns[1].isPinned).toBe(true)
    expect(result.current.columns[2].name).toBe("c1")
    expect(result.current.columns[2].isPinned).toBe(true)
  })

  it("activates column stretch with widthConfig.useStretch", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: false, // Should be overridden by widthConfig
    })

    const widthConfig = new streamlit.WidthConfig({ useStretch: true })
    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(
        element,
        data,
        false,
        element.columnOrder,
        widthConfig
      )
    })

    for (const column of result.current.columns) {
      expect(column.isStretched).toBe(true)
    }
  })

  it("does not activate column stretch with widthConfig.useContent", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: true, // Should be overridden by widthConfig
    })

    const widthConfig = new streamlit.WidthConfig({ useContent: true })
    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(
        element,
        data,
        false,
        element.columnOrder,
        widthConfig
      )
    })

    for (const column of result.current.columns) {
      expect(column.isStretched).toBe(false)
    }
  })

  it("activates column stretch with widthConfig.pixelWidth", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: false,
    })

    const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })
    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(
        element,
        data,
        false,
        element.columnOrder,
        widthConfig
      )
    })

    for (const column of result.current.columns) {
      expect(column.isStretched).toBe(true)
    }
  })

  it("falls back to container width with widthConfig undefined and useContainerWidth is false", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: false,
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    for (const column of result.current.columns) {
      expect(column.isStretched).toBe(false)
    }
  })

  it("falls back to container width with widthConfig undefined and useContainerWidth is true", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      useContainerWidth: true,
    })

    const data = new Quiver(element)

    const { result } = renderHook(() => {
      return useColumnLoader(element, data, false, element.columnOrder, null)
    })

    for (const column of result.current.columns) {
      expect(column.isStretched).toBe(true)
    }
  })
})
