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
import {
  Binary,
  Bool as BoolType,
  Decimal,
  Dictionary,
  Field,
  Float64,
  Int,
  Int64,
  List,
  Null,
  Struct,
  Timestamp,
  TimeUnit,
  Uint8,
  Utf8,
} from "apache-arrow"

import { Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

import { ArrowType, DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { getStyledCell, StyledCell } from "~lib/dataframes/pandasStylerUtils"
import { DataFrameCell, Quiver } from "~lib/dataframes/Quiver"
import {
  CATEGORICAL_COLUMN,
  DECIMAL,
  DISPLAY_VALUES,
  EMPTY,
  MULTI,
  STYLER,
  UNICODE,
} from "~lib/mocks/arrow"

import {
  applyPandasStylerCss,
  extractCssProperty,
  getCellFromArrow,
  getColumnTypeFromArrow,
  getConfiguredHeight,
  getConfiguredWidth,
  initAllColumnsFromArrow,
  initColumnFromArrow,
  initIndexFromArrow,
  shouldUseContainerWidth,
  shouldUseContentWidth,
} from "./arrowUtils"
import {
  CheckboxColumn,
  ColumnCreator,
  DateTimeColumn,
  getTextCell,
  ListColumn,
  NumberColumn,
  ObjectColumn,
  SelectboxColumn,
  TextColumn,
  TimeColumn,
} from "./columns"

const MOCK_TEXT_COLUMN = TextColumn({
  id: "1",
  name: "text_column",
  title: "Text column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("text_column", new Utf8(), true),
    pandasType: {
      field_name: "text_column",
      name: "text_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
})

const MOCK_NUMBER_COLUMN = NumberColumn({
  id: "1",
  name: "number_column",
  title: "Number column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  isPinned: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("number_column", new Int(true, 64), true),
    pandasType: {
      field_name: "number_column",
      name: "number_column",
      pandas_type: "int64",
      numpy_type: "int64",
      metadata: null,
    },
  },
})

describe("extractCssProperty", () => {
  it("should extract the correct property value", () => {
    const cssStyle1 = `
  #T_f116e_row10_col0, #T_f116e_row10_col1, #T_f116e_row10_col3 { color: red }
  #T_f116e_row0_col1, #T_f116e_row1_col0 { color: white; background-color: pink }
  #T_f116e_row0_col2 { color: red; opacity: 20% }
  #T_f116e_row2_col2, #T_f116e_row5_col1 { opacity: 20% }
  #T_f116e_row3_col3, #T_f116e_row12_col1 { color: white; background-color: darkblue; color: white; background-color: pink }
  #T_f116e_row11_col10, #T_f116e_row11_col10 {  background-color: darkblue }`

    // All color-value formats
    const cssStyle2 = `
  #T_7e5cc_row6_col0 { background-color: #f8fcc9; color: #000000 }
  #T_7e5cc_row7_col1 { background-color: #1c2d81; color: #f1f1f1 }
  #T_7e5cc_row8_col0 { background-color: #289cc1; color: #f1f1f1 }
  #T_7e5cc_row8_col1 { background-color: #2165ab; color: #f1f1f1 }
  #T_7e5cc_row9_col0 { background-color: #f0f9b8; color: #000000 }
  #T_f116e_row12_col14 { background-color: blue }
  #T_f116e_row13_col14 { background-color: #f1f1f1 }
  #T_f116e_row14_col1 { background-color: rgba(72 122 180 / .2); }
  #T_f116e_row15_col1 { background-color: rgba(255, 0, 12, .2)}
  #T_f116e_row16_col14 { background-color: hsla(240, 100%, 90%) }
  #T_f116e_row17_col1 { background-color: hsl(255, 0, 12)}`

    // Badly Formatted
    const cssStyle3 = `
  #T_f116e_row10_col0,#T_7e5cc_row6_col0   {   background-color: #f8fcc9;     color: #000000 }
  #T_7e5cc_row7_col1{ background-color:#1c2d81; color: #f1f1f1 }
  #T_7e5cc_row8_col0{background-color: #289cc1;color: #f1f1f1}
  #T_f116e_row18_col1, #T_f116e_row18_col14 { background-color: hsla(240, 100%,    90%) }
  #T_f116e_row19_col1, #T_f116e_row19_col14 { background-color: hsl(240, 100%,90%) }`

    expect(extractCssProperty("#T_f116e_row10_col1", "color", cssStyle1)).toBe(
      "red"
    )
    expect(
      extractCssProperty("#T_f116e_row12_col1", "background-color", cssStyle1)
    ).toBe("pink")
    expect(extractCssProperty("#T_f116e_row5_col1", "color", cssStyle1)).toBe(
      undefined
    )
    expect(extractCssProperty("foo", "color", cssStyle1)).toBe(undefined)
    expect(extractCssProperty("#T_f116e_row0_col2", "color", cssStyle1)).toBe(
      "red"
    )
    expect(
      extractCssProperty("#T_f116e_row11_col10", "background-color", cssStyle1)
    ).toBe("darkblue")
    // Should not extract if it only partly matches:
    expect(
      extractCssProperty("#T_f116e_row11_col1", "background-color", cssStyle1)
    ).toBe(undefined)

    expect(
      extractCssProperty("#T_7e5cc_row6_col0", "background-color", cssStyle2)
    ).toBe("#f8fcc9")
    expect(extractCssProperty("#T_7e5cc_row9_col0", "color", cssStyle2)).toBe(
      "#000000"
    )
    expect(
      extractCssProperty("#T_f116e_row12_col14", "background-color", cssStyle2)
    ).toBe("blue")
    expect(
      extractCssProperty("#T_f116e_row13_col14", "background-color", cssStyle2)
    ).toBe("#f1f1f1")
    expect(
      extractCssProperty("#T_f116e_row14_col1", "background-color", cssStyle2)
    ).toBe("rgba(72 122 180 / .2)")
    expect(
      extractCssProperty("#T_f116e_row15_col1", "background-color", cssStyle2)
    ).toBe("rgba(255, 0, 12, .2)")
    expect(
      extractCssProperty("#T_f116e_row16_col14", "background-color", cssStyle2)
    ).toBe("hsla(240, 100%, 90%)")
    expect(
      extractCssProperty("#T_f116e_row17_col1", "background-color", cssStyle2)
    ).toBe("hsl(255, 0, 12)")

    expect(
      extractCssProperty("#T_f116e_row10_col0", "background-color", cssStyle3)
    ).toBe("#f8fcc9")
    expect(
      extractCssProperty("#T_7e5cc_row8_col0", "background-color", cssStyle3)
    ).toBe("#289cc1")
    expect(
      extractCssProperty("#T_f116e_row18_col14", "background-color", cssStyle3)
    ).toBe("hsla(240, 100%,    90%)")
    expect(
      extractCssProperty("#T_f116e_row19_col14", "background-color", cssStyle3)
    ).toBe("hsl(240, 100%,90%)")
    expect(extractCssProperty("#T_7e5cc_row8_col0", "color", cssStyle3)).toBe(
      "#f1f1f1"
    )
  })
})

describe("applyPandasStylerCss", () => {
  it("should apply css to a cells", () => {
    const CSS_STYLES = `
  #T_f116e_row10_col0, #T_f116e_row10_col1, #T_f116e_row10_col3 { color: red }
  #T_f116e_row0_col1, #T_f116e_row1_col0 { color: white; background-color: pink }
  #T_f116e_row0_col2 { color: red; opacity: 20% }
  #T_f116e_row2_col2, #T_f116e_row5_col1 { opacity: 20% }
  #T_f116e_row3_col3, #T_f116e_row12_col1 { color: white; background-color: darkblue; color: white; background-color: pink }
  #T_f116e_row11_col10, #T_f116e_row11_col10 {  background-color: darkblue }`

    const MOCK_CELL = getTextCell(true, false)
    let styledCell = applyPandasStylerCss(
      MOCK_CELL,
      "#T_f116e_row11_col10",
      CSS_STYLES
    )
    expect(styledCell.themeOverride).toEqual({
      bgCell: "darkblue",
    })

    styledCell = applyPandasStylerCss(
      MOCK_CELL,
      "#T_f116e_row0_col2",
      CSS_STYLES
    )
    expect(styledCell.themeOverride).toEqual({
      textDark: "red",
    })

    styledCell = applyPandasStylerCss(
      MOCK_CELL,
      "#T_f116e_row3_col3",
      CSS_STYLES
    )
    expect(styledCell.themeOverride).toEqual({
      bgCell: "pink",
      textDark: "white",
    })

    styledCell = applyPandasStylerCss(MOCK_CELL, "invalid_key", CSS_STYLES)
    expect(styledCell.themeOverride).toEqual(undefined)
  })

  it("should use a grey color when background is yellow", () => {
    const CSS_STYLES = `#T_f116e_row0_col0 { background-color: yellow }`
    const styledCell = applyPandasStylerCss(
      getTextCell(true, false),
      "#T_f116e_row0_col0",
      CSS_STYLES
    )
    expect(styledCell.themeOverride).toEqual({
      bgCell: "yellow",
      textDark: "#31333F",
    })
  })
})

describe("initIndexFromArrow", () => {
  it("returns a valid index", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)

    const indexColumn = initIndexFromArrow(data, 0)
    expect(indexColumn).toEqual({
      id: `_index-0`,
      indexNumber: 0,
      isEditable: true,
      name: "",
      title: "",
      arrowType: {
        type: DataFrameCellType.INDEX,
        arrowField: expect.any(Field),
        pandasType: {
          field_name: "__index_level_0__",
          name: null,
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      isIndex: true,
      isPinned: true,
      isHidden: false,
      isStretched: false,
    })
  })

  it("works with multi-index", () => {
    const element = ArrowProto.create({
      data: MULTI,
    })
    const data = new Quiver(element)

    const indexColumn1 = initIndexFromArrow(data, 0)
    expect(indexColumn1).toEqual({
      id: `_index-0`,
      indexNumber: 0,
      isEditable: true,
      name: "number",
      title: "number",
      arrowType: {
        type: DataFrameCellType.INDEX,
        arrowField: expect.any(Field),
        pandasType: {
          field_name: "number",
          name: "number",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      group: "",
      isIndex: true,
      isPinned: true,
      isHidden: false,
      isStretched: false,
    })

    const indexColumn2 = initIndexFromArrow(data, 1)
    expect(indexColumn2).toEqual({
      id: `_index-1`,
      indexNumber: 1,
      isEditable: true,
      name: "color",
      title: "color",
      arrowType: {
        type: DataFrameCellType.INDEX,
        arrowField: expect.any(Field),
        pandasType: {
          field_name: "color",
          name: "color",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      group: "",
      isIndex: true,
      isPinned: true,
      isHidden: false,
      isStretched: false,
    })
  })
})

describe("initColumnFromArrow", () => {
  it("returns a valid column", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)

    const column = initColumnFromArrow(data, 1)
    expect(column).toEqual({
      id: "_column-c1-1",
      indexNumber: 1,
      name: "c1",
      title: "c1",
      isEditable: true,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("c1", new Utf8(), true),
        pandasType: {
          field_name: "c1",
          name: "c1",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      isIndex: false,
      isPinned: false,
      isHidden: false,
      isStretched: false,
    })
  })

  it("works with multi-index headers", () => {
    const element = ArrowProto.create({
      data: MULTI,
    })
    const data = new Quiver(element)

    const column = initColumnFromArrow(data, 2)
    expect(column).toEqual({
      id: "_column-red-2",
      indexNumber: 2,
      name: "red",
      title: "red",
      isEditable: true,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("('1', 'red')", new Utf8(), true),
        pandasType: {
          field_name: "('1', 'red')",
          name: "('1', 'red')",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      isIndex: false,
      isPinned: false,
      isHidden: false,
      isStretched: false,
      group: "1",
    })
  })

  it("adds categorical options to type metadata", () => {
    const element = ArrowProto.create({
      data: CATEGORICAL_COLUMN,
    })
    const data = new Quiver(element)

    const column = initColumnFromArrow(data, 1)
    expect(column).toEqual({
      id: "_column-c1-1",
      indexNumber: 1,
      name: "c1",
      title: "c1",
      isEditable: true,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: expect.any(Field),
        pandasType: {
          field_name: "c1",
          name: "c1",
          pandas_type: "categorical",
          numpy_type: "int8",
          metadata: {
            num_categories: 2,
            ordered: false,
          },
        },
        categoricalOptions: ["bar", "foo"],
      },
      isIndex: false,
      isPinned: false,
      isHidden: false,
      isStretched: false,
    })
  })
})
describe("initAllColumnsFromArrow", () => {
  it("extracts all columns", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)
    const columns = initAllColumnsFromArrow(data)

    expect(columns).toEqual([
      {
        arrowType: {
          type: DataFrameCellType.INDEX,
          arrowField: new Field("__index_level_0__", new Utf8(), true),
          pandasType: {
            field_name: "__index_level_0__",
            metadata: null,
            name: null,
            numpy_type: "object",
            pandas_type: "unicode",
          },
        },
        id: "_index-0",
        indexNumber: 0,
        isEditable: true,
        isHidden: false,
        isIndex: true,
        isPinned: true,
        isStretched: false,
        name: "",
        title: "",
      },
      {
        arrowType: {
          type: DataFrameCellType.DATA,
          arrowField: new Field("c1", new Utf8(), true),
          pandasType: {
            field_name: "c1",
            name: "c1",
            pandas_type: "unicode",
            numpy_type: "object",
            metadata: null,
          },
        },
        columnTypeOptions: undefined,
        id: "_column-c1-1",
        indexNumber: 1,
        isEditable: true,
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
        name: "c1",
        title: "c1",
        group: undefined,
      },
      {
        arrowType: {
          type: DataFrameCellType.DATA,
          arrowField: new Field("c2", new Utf8(), true),
          pandasType: {
            field_name: "c2",
            name: "c2",
            pandas_type: "unicode",
            numpy_type: "object",
            metadata: null,
          },
        },
        columnTypeOptions: undefined,
        id: "_column-c2-2",
        indexNumber: 2,
        isEditable: true,
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
        name: "c2",
        title: "c2",
        group: undefined,
      },
    ])
  })

  it("handles empty dataframes correctly", () => {
    const element = ArrowProto.create({
      data: EMPTY,
    })
    const data = new Quiver(element)
    const columns = initAllColumnsFromArrow(data)

    expect(columns).toEqual([
      {
        arrowType: {
          type: DataFrameCellType.INDEX,
          arrowField: new Field("__index_level_0__", new Null(), true),
          pandasType: {
            field_name: "__index_level_0__",
            metadata: null,
            name: null,
            numpy_type: "object",
            pandas_type: "empty",
          },
        },
        id: "_index-0",
        indexNumber: 0,
        isEditable: true,
        isHidden: false,
        isIndex: true,
        isPinned: true,
        isStretched: false,
        name: "",
        title: "",
      },
    ])
  })
})

describe("getCellFromArrow", () => {
  it("creates a valid glide-compatible cell", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)
    const cell = getCellFromArrow(
      MOCK_TEXT_COLUMN,
      data.getCell(0, 1),
      undefined,
      undefined
    )

    expect(cell).toEqual({
      allowOverlay: true,
      contentAlignment: undefined,
      data: "foo",
      displayData: "foo",
      isMissingValue: false,
      kind: "text",
      readonly: true,
      style: "normal",
    })
  })

  it("handles decimal types correctly", () => {
    const decimalColumn = NumberColumn({
      id: "1",
      name: "decimal_column",
      title: "Decimal column",
      indexNumber: 0,
      isEditable: false,
      isHidden: false,
      isIndex: false,
      isPinned: false,
      isStretched: false,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("decimal_column", new Decimal(6, 1), true),
        pandasType: {
          field_name: "decimal_column",
          name: "decimal_column",
          pandas_type: "decimal",
          numpy_type: "object",
          metadata: { precision: 6, scale: 1 },
        },
      },
    })

    const element = ArrowProto.create({
      data: DECIMAL, // should be interpreted as object
    })
    const data = new Quiver(element)
    const cell = getCellFromArrow(
      decimalColumn,
      data.getCell(0, 1),
      undefined,
      undefined
    )

    expect(cell).toEqual({
      allowNegative: true,
      allowOverlay: true,
      contentAlign: "right",
      copyData: "1.1",
      data: 1.1,
      displayData: "1.1",
      isMissingValue: false,
      fixedDecimals: undefined,
      kind: "number",
      readonly: true,
      style: "normal",
      thousandSeparator: "",
    })
  })

  it("applies display content overwrite to time cells", () => {
    const MOCK_TIME_COLUMN = {
      ...TimeColumn({
        id: "1",
        name: "time_column",
        title: "Time column",
        indexNumber: 0,
        isEditable: false,
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
        arrowType: {
          type: DataFrameCellType.DATA,
          arrowField: new Field(
            "time_column",
            new Timestamp(TimeUnit.SECOND),
            true
          ),
          pandasType: {
            field_name: "time_column",
            name: "time_column",
            pandas_type: "time",
            numpy_type: "object",
            metadata: null,
          },
        },
      }),
    }

    // Create a mock arrowCell object with time data
    const arrowCell = {
      // Unix timestamp in microseconds Wed Sep 29 2021 21:13:20
      // Our default unit is seconds, so it needs to be adjusted internally
      content: BigInt(1632950000123000),
      contentType: MOCK_TIME_COLUMN.arrowType,
      field: {
        type: {
          unit: 2, // Microseconds
        },
      },
      type: "columns",
    } as object as DataFrameCell

    const styledCell = {
      displayContent: "FOOO",
      cssId: "FAKE_ID",
      cssClass: "FAKE_CLASS",
    } as StyledCell

    // Call the getCellFromArrow function
    const cell = getCellFromArrow(
      MOCK_TIME_COLUMN,
      arrowCell,
      styledCell,
      undefined
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    expect((cell as any).data.displayDate).toEqual("FOOO")
  })

  it("doesn't apply display content from styler if format is set", () => {
    const MOCK_TIME_COLUMN = {
      ...TimeColumn({
        id: "1",
        name: "time_column",
        title: "Time column",
        indexNumber: 0,
        isEditable: false,
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
        columnTypeOptions: {
          format: "YYYY",
        },
        arrowType: {
          type: DataFrameCellType.DATA,
          arrowField: new Field(
            "time_column",
            new Timestamp(TimeUnit.SECOND),
            true
          ),
          pandasType: {
            field_name: "time_column",
            name: "time_column",
            pandas_type: "time",
            numpy_type: "object",
            metadata: null,
          },
        },
      }),
    }

    // Create a mock arrowCell object with time data
    const arrowCell = {
      // Unix timestamp in microseconds Wed Sep 29 2021 21:13:20
      // Our default unit is seconds, so it needs to be adjusted internally
      content: BigInt(1632950000123000),
      contentType: MOCK_TIME_COLUMN.arrowType,
      field: {
        type: {
          unit: 2, // Microseconds
        },
      },
      type: "columns",
    } as object as DataFrameCell

    const styledCell = {
      displayContent: "FOOO",
      cssId: "FAKE_ID",
      cssClass: "FAKE_CLASS",
    } as StyledCell

    // Call the getCellFromArrow function
    const cell = getCellFromArrow(MOCK_TIME_COLUMN, arrowCell, styledCell)
    // Should use the formatted value from the cell and not the displayContent
    // from pandas styler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    expect((cell as any).data.displayDate).toEqual("2021")
  })

  it("parses numeric timestamps for time columns into valid Date values", () => {
    const MOCK_TIME_COLUMN = {
      ...TimeColumn({
        id: "1",
        name: "time_column",
        title: "Time column",
        indexNumber: 0,
        isEditable: false,
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
        arrowType: {
          type: DataFrameCellType.DATA,
          arrowField: new Field(
            "time_column",
            new Timestamp(TimeUnit.SECOND),
            true
          ),
          pandasType: {
            field_name: "time_column",
            name: "time_column",
            pandas_type: "time",
            numpy_type: "object",
            metadata: null,
          },
        },
      }),
      getCell: vi.fn().mockReturnValue(getTextCell(false, false)),
    }

    // Create a mock arrowCell object with time data
    const arrowCell = {
      // Unix timestamp in microseconds Wed Sep 29 2021 21:13:20
      // Our default unit is seconds, so it needs to be adjusted internally
      content: BigInt(1632950000123000),
      contentType: MOCK_TIME_COLUMN.arrowType,
      field: {
        type: {
          unit: 2, // Microseconds
        },
      },
      type: "columns",
    } as object as DataFrameCell

    // Call the getCellFromArrow function
    getCellFromArrow(MOCK_TIME_COLUMN, arrowCell, undefined, undefined)

    // Check if the timestamp is adjusted properly
    expect(MOCK_TIME_COLUMN.getCell).toHaveBeenCalledWith(
      new Date("2021-09-29T21:13:20.123Z")
    )
  })

  it("parses numeric timestamps for datetime columns into valid Date values", () => {
    const MOCK_TIME_COLUMN = {
      ...TimeColumn({
        id: "1",
        name: "datetime_column",
        title: "Datetime column",
        indexNumber: 0,
        isEditable: false,
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
        arrowType: {
          type: DataFrameCellType.DATA,
          arrowField: new Field(
            "datetime_column",
            new Timestamp(TimeUnit.SECOND),
            true
          ),
          pandasType: {
            field_name: "datetime_column",
            name: "datetime_column",
            pandas_type: "datetime",
            numpy_type: "datetime64[ns]",
            metadata: null,
          },
        },
      }),
      getCell: vi.fn().mockReturnValue(getTextCell(false, false)),
    }

    // Create a mock arrowCell object with time data
    const arrowCell = {
      // Unix timestamp in milliseconds (Wed Sep 29 2021 21:13:20)
      // Milliseconds is the default unit that is used for all datetime values
      // in arrow. So we don't need to adjust based on the unit here. It just
      // needs conversion from milliseconds unix timestamp to Date object.
      // Our internal parsing assumes seconds as default unit.
      content: 1632950000123,
      contentType: null,
      type: "columns",
    } as object as DataFrameCell

    // Call the getCellFromArrow function
    getCellFromArrow(MOCK_TIME_COLUMN, arrowCell, undefined, undefined)

    // Check if the timestamp is adjusted properly
    expect(MOCK_TIME_COLUMN.getCell).toHaveBeenCalledWith(
      new Date("2021-09-29T21:13:20.123Z")
    )
  })

  it("applies display content from arrow cell", () => {
    const element = {
      data: STYLER,
      styler: {
        uuid: "FAKE_UUID",
        styles: "FAKE_CSS",
        displayValues: DISPLAY_VALUES,
        caption: "FAKE_CAPTION",
      },
    }
    const data = new Quiver(element)

    const cell = getCellFromArrow(
      MOCK_NUMBER_COLUMN,
      data.getCell(0, 1),
      getStyledCell(data, 0, 1),
      undefined
    )

    expect(cell).toEqual({
      allowOverlay: true,
      contentAlign: "right",
      copyData: "1",
      data: 1,
      displayData: "1",
      isMissingValue: false,
      kind: "number",
      readonly: true,
      style: "normal",
      thousandSeparator: "",
      allowNegative: true,
      fixedDecimals: 0,
    })
  })

  it("applies Pandas styler CSS", () => {
    const element = {
      data: STYLER,
      styler: {
        uuid: "FAKE_UUID",
        styles:
          "#T_FAKE_UUID_row1_col1, #T_FAKE_UUID_row0_col0 { color: white; background-color: pink }",
        displayValues: DISPLAY_VALUES,
        caption: "FAKE_CAPTION",
      },
    }
    const data = new Quiver(element)

    const cell = getCellFromArrow(
      MOCK_NUMBER_COLUMN,
      data.getCell(0, 1),
      getStyledCell(data, 0, 1),
      element.styler.styles
    )

    expect(cell).toEqual({
      allowOverlay: true,
      contentAlign: "right",
      copyData: "1",
      data: 1,
      displayData: "1",
      isMissingValue: false,
      kind: "number",
      readonly: true,
      style: "normal",
      allowNegative: true,
      fixedDecimals: 0,
      themeOverride: {
        bgCell: "pink",
        textDark: "white",
      },
      thousandSeparator: "",
    })
  })
})

it("doesn't apply Pandas Styler CSS for editable columns", () => {
  const element = {
    data: STYLER,
    styler: {
      uuid: "FAKE_UUID",
      styles:
        "#T_FAKE_UUID_row1_col1, #T_FAKE_UUID_row0_col0 { color: white; background-color: pink }",
      displayValues: DISPLAY_VALUES,
      caption: "FAKE_CAPTION",
    },
  }
  const data = new Quiver(element)

  const cell = getCellFromArrow(
    { ...MOCK_NUMBER_COLUMN, isEditable: true },
    data.getCell(0, 1),
    getStyledCell(data, 0, 1),
    element.styler.styles
  )

  expect(cell).toEqual({
    allowOverlay: true,
    contentAlign: "right",
    copyData: "1",
    data: 1,
    displayData: "1",
    isMissingValue: false,
    kind: "number",
    readonly: true,
    style: "normal",
    thousandSeparator: "",
    allowNegative: true,
    fixedDecimals: 0,
  })
})

describe("getColumnTypeFromArrow", () => {
  it.each([
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Float64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "float64",
          numpy_type: "float64",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      NumberColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int(true, 64), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      NumberColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int(false, 64), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "uint64",
          numpy_type: "uint64",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      NumberColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new BoolType(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bool",
          numpy_type: "bool",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      CheckboxColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Timestamp(TimeUnit.NANOSECOND),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      DateTimeColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new List(new Field("test", new Int64(), true)),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "list[int64]",
          numpy_type: "object",
          metadata: null,
        },
      },
      ListColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Struct([]), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "object",
          metadata: null,
        },
      },
      ObjectColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Dictionary(new Utf8(), new Uint8()),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "categorical",
          numpy_type: "object",
          metadata: null,
        },
      },
      SelectboxColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Struct([
            new Field("left", new Int64(), true),
            new Field("right", new Int64(), true),
          ]),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "interval[int64, both]",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      ObjectColumn,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Binary(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bytes",
          numpy_type: "object",
          metadata: null,
        },
        categoricalOptions: undefined,
      },
      ObjectColumn,
    ],
  ])(
    "interprets %s as column type: %s",
    (arrowType: ArrowType, expectedType: ColumnCreator) => {
      expect(getColumnTypeFromArrow(arrowType)).toEqual(expectedType)
    }
  )
})

it("uses arrowCell.contentType instead of column.arrowType for object types", () => {
  const MOCK_OBJECT_COLUMN = ObjectColumn({
    id: "1",
    name: "object_column",
    title: "Object column",
    indexNumber: 0,
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("object_column", new Float64(), true),
      pandasType: undefined,
    },
  })

  // Create a mock arrowCell with a string content type instead of number
  const arrowCell = {
    content: 0.12345678,
    contentType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("object_column", new Utf8(), true),
      pandasType: undefined,
    },
    type: "data",
  } as object as DataFrameCell

  const cell = getCellFromArrow(
    MOCK_OBJECT_COLUMN,
    arrowCell,
    undefined,
    undefined
  )

  // The cell should be formatted as a string since arrowCell.contentType is Utf8
  expect(cell).toEqual({
    allowOverlay: true,
    contentAlignment: undefined,
    // the float type would have formatted the number to 0.1235
    data: "0.12345678",
    displayData: "0.12345678",
    isMissingValue: false,
    kind: "text",
    readonly: true,
    style: "normal",
  })
})

describe("width configuration utilities", () => {
  describe("shouldUseContainerWidth", () => {
    it("returns true when widthConfig.useStretch is true", () => {
      const element = ArrowProto.create({ useContainerWidth: false })
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(true)
    })

    it("returns false when widthConfig.useStretch is false", () => {
      const element = ArrowProto.create({ useContainerWidth: true })
      const widthConfig = new streamlit.WidthConfig({ useStretch: false })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.useContent is true", () => {
      const element = ArrowProto.create({ useContainerWidth: true })
      const widthConfig = new streamlit.WidthConfig({ useContent: true })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.pixelWidth is set", () => {
      const element = ArrowProto.create({ useContainerWidth: true })
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(false)
    })

    it("falls back to element.useContainerWidth when widthConfig is null", () => {
      const element = ArrowProto.create({ useContainerWidth: true })

      expect(shouldUseContainerWidth(element, null)).toBe(true)
    })

    it("falls back to element.useContainerWidth when widthConfig is undefined", () => {
      const element = ArrowProto.create({ useContainerWidth: false })

      expect(shouldUseContainerWidth(element, undefined)).toBe(false)
    })

    it("returns false when element.useContainerWidth is undefined", () => {
      const element = ArrowProto.create({})

      expect(shouldUseContainerWidth(element, null)).toBe(false)
    })
  })

  describe("shouldUseContentWidth", () => {
    it("returns true when widthConfig.useContent is true", () => {
      const widthConfig = new streamlit.WidthConfig({ useContent: true })

      expect(shouldUseContentWidth(widthConfig)).toBe(true)
    })

    it("returns false when widthConfig.useContent is false", () => {
      const widthConfig = new streamlit.WidthConfig({ useContent: false })

      expect(shouldUseContentWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.useStretch is true", () => {
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })

      expect(shouldUseContentWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.pixelWidth is set", () => {
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(shouldUseContentWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig is null", () => {
      expect(shouldUseContentWidth(null)).toBe(false)
    })

    it("returns false when widthConfig is undefined", () => {
      expect(shouldUseContentWidth(undefined)).toBe(false)
    })
  })

  describe("getConfiguredWidth", () => {
    it("returns widthConfig.pixelWidth when set", () => {
      const element = ArrowProto.create({ width: 300 })
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(getConfiguredWidth(element, widthConfig)).toBe(400)
    })

    it("falls back to element.width when widthConfig is null", () => {
      const element = ArrowProto.create({ width: 300 })

      expect(getConfiguredWidth(element, null)).toBe(300)
    })

    it("returns element.width when element.width is not set (default value)", () => {
      const element = ArrowProto.create({})

      expect(getConfiguredWidth(element, null)).toBe(undefined)
    })

    it("returns undefined when widthConfig.pixelWidth is 0", () => {
      const element = ArrowProto.create({ width: 300 })
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 0 })

      expect(getConfiguredWidth(element, widthConfig)).toBe(undefined)
    })

    it("returns undefined when element.width is 0", () => {
      const element = ArrowProto.create({ width: 0 })

      expect(getConfiguredWidth(element, null)).toBe(undefined)
    })
  })

  describe("getConfiguredHeight", () => {
    it("returns heightConfig.pixelHeight when set", () => {
      const element = ArrowProto.create({ height: 300 })
      const heightConfig = new streamlit.HeightConfig({ pixelHeight: 400 })

      expect(getConfiguredHeight(element, heightConfig)).toBe(400)
    })

    it("falls back to element.height when heightConfig is null", () => {
      const element = ArrowProto.create({ height: 300 })

      expect(getConfiguredHeight(element, null)).toBe(300)
    })

    it("returns undefined when element.height is not set (default value)", () => {
      const element = ArrowProto.create({})

      expect(getConfiguredHeight(element, null)).toBe(undefined)
    })

    it("returns undefined when heightConfig.pixelHeight is 0", () => {
      const element = ArrowProto.create({ height: 300 })
      const heightConfig = new streamlit.HeightConfig({ pixelHeight: 0 })

      expect(getConfiguredHeight(element, heightConfig)).toBe(undefined)
    })

    it("returns undefined when element.height is 0", () => {
      const element = ArrowProto.create({ height: 0 })

      expect(getConfiguredHeight(element, null)).toBe(undefined)
    })
  })
})
