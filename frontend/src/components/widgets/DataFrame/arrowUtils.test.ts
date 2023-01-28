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

import { Quiver, Type as ArrowType } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"
import {
  UNICODE,
  MULTI,
  CATEGORICAL_COLUMN,
  DECIMAL,
  STYLER,
  DISPLAY_VALUES,
  EMPTY,
} from "src/lib/mocks/arrow"

import {
  getTextCell,
  ColumnCreator,
  ObjectColumn,
  BooleanColumn,
  NumberColumn,
  TextColumn,
  CategoricalColumn,
  ListColumn,
} from "./columns"
import {
  extractCssProperty,
  processDisplayData,
  applyPandasStylerCss,
  getColumnTypeFromArrow,
  getIndexFromArrow,
  getColumnFromArrow,
  getAllColumnsFromArrow,
  getCellFromArrow,
} from "./arrowUtils"

const MOCK_TEXT_COLUMN = TextColumn({
  id: "1",
  title: "Text column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    pandas_type: "unicode",
    numpy_type: "object",
  },
})

const MOCK_NUMBER_COLUMN = NumberColumn({
  id: "1",
  title: "Number column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    pandas_type: "int64",
    numpy_type: "int64",
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

test("processDisplayData should remove line breaks", () => {
  expect(processDisplayData("\n")).toBe(" ")
  expect(processDisplayData("\nhello\n\nworld")).toBe(" hello  world")
})

test("applyPandasStylerCss should apply css to a cells", () => {
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
  expect(styledCell.themeOverride).toEqual({})
})

describe("getIndexFromArrow", () => {
  it("returns a valid index", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)

    const indexColumn = getIndexFromArrow(data, 0)
    expect(indexColumn).toEqual({
      id: `index-0`,
      isEditable: true,
      title: "",
      arrowType: {
        meta: null,
        numpy_type: "object",
        pandas_type: "unicode",
      },
      isIndex: true,
      isHidden: false,
    })
  })

  it("works with multi-index", () => {
    const element = ArrowProto.create({
      data: MULTI,
    })
    const data = new Quiver(element)

    const indexColumn1 = getIndexFromArrow(data, 0)
    expect(indexColumn1).toEqual({
      id: `index-0`,
      isEditable: true,
      title: "number",
      arrowType: {
        meta: null,
        numpy_type: "int64",
        pandas_type: "int64",
      },
      isIndex: true,
      isHidden: false,
    })

    const indexColumn2 = getIndexFromArrow(data, 1)
    expect(indexColumn2).toEqual({
      id: `index-1`,
      isEditable: true,
      title: "color",
      arrowType: {
        meta: null,
        numpy_type: "object",
        pandas_type: "unicode",
      },
      isIndex: true,
      isHidden: false,
    })
  })
})

describe("getColumnFromArrow", () => {
  it("returns a valid column", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)

    const column = getColumnFromArrow(data, 0)
    expect(column).toEqual({
      id: "column-c1-0",
      title: "c1",
      isEditable: true,
      arrowType: {
        meta: null,
        numpy_type: "object",
        pandas_type: "unicode",
      },
      isIndex: false,
      isHidden: false,
    })
  })

  it("adds categorical options to type metadata", () => {
    const element = ArrowProto.create({
      data: CATEGORICAL_COLUMN,
    })
    const data = new Quiver(element)

    const column = getColumnFromArrow(data, 0)
    expect(column).toEqual({
      id: "column-c1-0",
      title: "c1",
      isEditable: true,
      arrowType: {
        meta: {
          num_categories: 2,
          ordered: false,
        },
        numpy_type: "int8",
        pandas_type: "categorical",
      },
      isIndex: false,
      isHidden: false,
      columnTypeMetadata: {
        options: ["", "bar", "foo"],
      },
    })
  })
})
describe("getAllColumnsFromArrow", () => {
  it("extracts all columns", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)
    const columns = getAllColumnsFromArrow(data)

    expect(columns).toEqual([
      {
        arrowType: {
          meta: null,
          numpy_type: "object",
          pandas_type: "unicode",
        },
        id: "index-0",
        indexNumber: 0,
        isEditable: true,
        isHidden: false,
        isIndex: true,
        title: "",
      },
      {
        arrowType: {
          meta: null,
          numpy_type: "object",
          pandas_type: "unicode",
        },
        columnTypeMetadata: undefined,
        id: "column-c1-0",
        indexNumber: 1,
        isEditable: true,
        isHidden: false,
        isIndex: false,
        title: "c1",
      },
      {
        arrowType: {
          meta: null,
          numpy_type: "object",
          pandas_type: "unicode",
        },
        columnTypeMetadata: undefined,
        id: "column-c2-1",
        indexNumber: 2,
        isEditable: true,
        isHidden: false,
        isIndex: false,
        title: "c2",
      },
    ])
  })

  it("handles empty dataframes correctly", () => {
    // TODO: is this correct
    const element = ArrowProto.create({
      data: EMPTY,
    })
    const data = new Quiver(element)
    const columns = getAllColumnsFromArrow(data)

    expect(columns).toEqual([
      {
        arrowType: {
          meta: null,
          numpy_type: "object",
          pandas_type: "empty",
        },
        id: "index-0",
        indexNumber: 0,
        isEditable: true,
        isHidden: false,
        isIndex: true,
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
    const cell = getCellFromArrow(MOCK_TEXT_COLUMN, data.getCell(1, 1))

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

  it("uses quiver formatting for object cells", () => {
    const objectColumn = ObjectColumn({
      id: "1",
      title: "Object column",
      indexNumber: 0,
      isEditable: false,
      isHidden: false,
      isIndex: false,
      isStretched: false,
      arrowType: {
        pandas_type: "decimal",
        numpy_type: "object",
        meta: { precision: 6, scale: 1 },
      },
    })

    const element = ArrowProto.create({
      data: DECIMAL, // should be interpreted as object
    })
    const data = new Quiver(element)
    const cell = getCellFromArrow(objectColumn, data.getCell(1, 1))

    expect(cell).toEqual({
      allowOverlay: true,
      contentAlignment: undefined,
      data: "1.1",
      displayData: "1.1",
      isMissingValue: false,
      kind: "text",
      readonly: true,
      style: "normal",
    })
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
    const cell = getCellFromArrow(MOCK_NUMBER_COLUMN, data.getCell(1, 1))

    expect(cell).toEqual({
      allowOverlay: true,
      contentAlign: "right",
      data: 1,
      displayData: "1",
      isMissingValue: false,
      kind: "number",
      readonly: true,
      style: "normal",
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
          "#T_FAKE_UUIDrow1_col1, #T_FAKE_UUIDrow0_col0 { color: white; background-color: pink }",
        displayValues: DISPLAY_VALUES,
        caption: "FAKE_CAPTION",
      },
    }
    const data = new Quiver(element)

    const cell = getCellFromArrow(
      MOCK_NUMBER_COLUMN,
      data.getCell(1, 1),
      element.styler.styles
    )

    expect(cell).toEqual({
      allowOverlay: true,
      contentAlign: "right",
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
    })
  })
})

describe("getColumnTypeFromArrow", () => {
  it.each([
    [
      {
        pandas_type: "float64",
        numpy_type: "float64",
      },
      NumberColumn,
    ],
    [
      {
        pandas_type: "int64",
        numpy_type: "int64",
      },
      NumberColumn,
    ],
    [
      {
        pandas_type: "uint64",
        numpy_type: "uint64",
      },
      NumberColumn,
    ],
    [
      {
        pandas_type: "unicode",
        numpy_type: "object",
      },
      TextColumn,
    ],
    [
      {
        pandas_type: "bool",
        numpy_type: "bool",
      },
      BooleanColumn,
    ],
    [
      {
        pandas_type: "categorical",
        numpy_type: "int8", // TODO: confirm this
      },
      CategoricalColumn,
    ],
    [
      {
        pandas_type: "object",
        numpy_type: "list[unicode]",
      },
      ListColumn,
    ],
    [
      {
        pandas_type: "object",
        numpy_type: "object",
      },
      ObjectColumn,
    ],
    [
      {
        pandas_type: "decimal",
        numpy_type: "object",
      },
      ObjectColumn,
    ],
    // TODO: add more types
  ])(
    "interprets %p as column type: %p",
    (arrowType: ArrowType, expectedType: ColumnCreator) => {
      expect(getColumnTypeFromArrow(arrowType)).toEqual(expectedType)
    }
  )
})
