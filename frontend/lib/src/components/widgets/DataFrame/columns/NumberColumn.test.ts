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
/* eslint-disable  @typescript-eslint/no-non-null-assertion */

import { GridCellKind, NumberCell } from "@glideapps/glide-data-grid"
import { Field, Float64, Int64, Uint64 } from "apache-arrow"

import {
  ArrowType,
  DataFrameCellType,
  DataType,
} from "~lib/dataframes/arrowTypeUtils"

import NumberColumn, { NumberColumnParams } from "./NumberColumn"
import { BaseColumnProps, ErrorCell, isErrorCell } from "./utils"

const MOCK_FLOAT_ARROW_TYPE: ArrowType = {
  type: DataFrameCellType.DATA,
  arrowField: new Field("float_column", new Float64(), true),
  pandasType: {
    field_name: "float_column",
    name: "float_column",
    pandas_type: "float64",
    numpy_type: "float64",
    metadata: null,
  },
}

const MOCK_INT_ARROW_TYPE: ArrowType = {
  type: DataFrameCellType.DATA,
  arrowField: new Field("int_column", new Int64(), true),
  pandasType: {
    field_name: "int_column",
    name: "int_column",
    pandas_type: "int64",
    numpy_type: "int64",
    metadata: null,
  },
}

const MOCK_UINT_ARROW_TYPE: ArrowType = {
  type: DataFrameCellType.DATA,
  arrowField: new Field("uint_column", new Uint64(), true),
  pandasType: {
    field_name: "uint_column",
    name: "uint_column",
    pandas_type: "uint64",
    numpy_type: "uint64",
    metadata: null,
  },
}

const NUMBER_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  name: "number_column",
  title: "Number column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
}

function getNumberColumn(
  arrowType: ArrowType,
  params?: NumberColumnParams
): ReturnType<typeof NumberColumn> {
  return NumberColumn({
    ...NUMBER_COLUMN_TEMPLATE,
    arrowType,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

describe("NumberColumn", () => {
  afterEach(() => {
    // Restore original value after each test
    Object.defineProperty(navigator, "languages", {
      value: navigator.languages,
      configurable: true,
    })
  })

  it("creates a valid column instance", () => {
    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
    expect(mockColumn.kind).toEqual("number")
    expect(mockColumn.title).toEqual(NUMBER_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(NUMBER_COLUMN_TEMPLATE.id)
    expect(mockColumn.isEditable).toEqual(NUMBER_COLUMN_TEMPLATE.isEditable)
    expect(mockColumn.sortMode).toEqual("smart")

    const mockCell = mockColumn.getCell("1.234")
    expect(mockCell.kind).toEqual(GridCellKind.Number)
    expect((mockCell as NumberCell).displayData).toEqual("1.234")
    expect((mockCell as NumberCell).data).toEqual(1.234)
  })

  it("aligns numbers to the right", () => {
    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
    const mockCell = mockColumn.getCell("1.123")
    expect(mockCell.contentAlign).toEqual("right")
  })

  it.each([
    [true, 1],
    [false, 0],
    ["4.12", 4.12],
    ["-4.12", -4.12],
    ["4", 4],
    [1.3122, 1.3122],
    [-1.3122, -1.3122],
    ["1,212.12", 1212.12],
    [".1312314", 0.1312314],
    [null, null],
    [undefined, null],
    ["", null],
  ])(
    "supports float64 value (%p parsed as %p)",
    (input: DataType | null | undefined, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    [100, 100],
    [-100, -100],
    ["4", 4],
    ["4.12", 4],
    ["4.61", 4],
    ["-4.12", -4],
    [1.3122, 1],
    [-1.3122, -1],
    ["1,212", 1212],
    ["1,212,123,312", 1212123312],
    [null, null],
  ])(
    "supports integer value (%p parsed as %p)",
    (input: DataType | null, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_INT_ARROW_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it("properly configures the column for unsigned integers", () => {
    const mockColumn = getNumberColumn(MOCK_UINT_ARROW_TYPE)
    expect(mockColumn.kind).toEqual("number")

    const mockCell = mockColumn.getCell("104")
    expect(mockCell.kind).toEqual(GridCellKind.Number)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    expect((mockCell as any).fixedDecimals).toEqual(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    expect((mockCell as any).allowNegative).toEqual(false)
  })

  it.each([
    [100, true],
    [-100, false],
    ["4", true],
    ["-4.12", false],
  ])(
    "supports unsigned integer validation (%p validates to %p)",
    (input: DataType | null, valid: boolean) => {
      const mockColumn = getNumberColumn(MOCK_UINT_ARROW_TYPE)
      expect(mockColumn.validateInput!(input)).toEqual(valid)
    }
  )

  it.each([
    [0, 1.234567, 1],
    [0.1, 1.234567, 1.2],
    [0.01, 1.234567, 1.23],
    [0.001, 1.234567, 1.234],
    [0.0001, 1.234567, 1.2345],
    [0.001, 1.1, 1.1],
    [0.00000001, 1, 1],
  ])(
    "converts value to precision from step %p (%p converted to %p)",
    (step: number, input: DataType, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        step,
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(value)
    }
  )

  it.each([
    [0, 1.234567, "1"],
    [0.1, 1.234567, "1.2"],
    [0.01, 1.234567, "1.23"],
    [0.001, 1.234567, "1.234"],
    [0.0001, 1.234567, "1.2345"],
    [0.001, 1.1, "1.100"],
    [0.00000001, 1, "1.00000000"],
  ])(
    "correctly adapts default value to precision from step %p (%p displayed as %p)",
    (step: number, input: DataType, displayValue: string) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        step,
      })
      const mockCell = mockColumn.getCell(input)
      expect((mockCell as NumberCell).displayData).toEqual(displayValue)
    }
  )

  it.each([
    [10, 10, true],
    [10, 100, true],
    [10, 5, false],
    [10, -5, false],
  ])(
    "supports minimal value configuration %p (%p validates to %p)",
    (min_value: number, input: DataType, valid: boolean) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        min_value,
      })
      expect(mockColumn.validateInput!(input)).toEqual(valid)
    }
  )

  it.each([
    [10, 10, true],
    [10, 100, 10],
    [10, 5, true],
    [10, -5, true],
  ])(
    "supports maximal value configuration %p (%p validates to %p)",
    (max_value: number, input: DataType, validation: number | boolean) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        max_value,
      })
      expect(mockColumn.validateInput!(input)).toEqual(validation)
    }
  )

  it.each([
    [[]],
    ["foo"],
    [[1, 2]],
    ["123.124.123"],
    ["--123"],
    ["2,,2"],
    ["12345678987654321"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  ])("%p results in error cell", (input: any) => {
    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })

  it("shows an error cell if the numeric value is too large", () => {
    const mockColumn = getNumberColumn(MOCK_INT_ARROW_TYPE)
    const unsafeCell = mockColumn.getCell("1234567898765432123")
    expect(isErrorCell(unsafeCell)).toEqual(true)
    expect((unsafeCell as ErrorCell)?.data).toEqual("1234567898765432123")
    expect((unsafeCell as ErrorCell)?.errorDetails).toEqual(
      "The value is larger than the maximum supported integer values in number columns (2^53)."
    )
  })

  it("doesn't show an error for large integers with a size up to 2^53", () => {
    const mockColumn = getNumberColumn(MOCK_INT_ARROW_TYPE)

    const safeCell = mockColumn.getCell("1234567898765432")
    expect(isErrorCell(safeCell)).toEqual(false)
  })

  it.each([
    // This should support everything that is supported by formatNumber
    // So we are not testing all the cases here, just a few to make sure it works
    // All other cases are tested for formatNumber in utils.test.ts
    [10.123, "%d", "10"],
    [10.123, "%i", "10"],
    [10.123, "%u", "10"],
    [10.123, "%f", "10.123"],
    [10.123, "%g", "10.123"],
    [10, "$%.2f", "$10.00"],
    [10.126, "$%.2f", "$10.13"],
    [10.123, "%.2f€", "10.12€"],
    [10.126, "($%.2f)", "($10.13)"],
    [65, "%d years", "65 years"],
    [1234567898765432, "%d ⭐", "1234567898765432 ⭐"],
    [72.3, "%.1f%%", "72.3%"],
    [-5.678, "%.1f", "-5.7"],
    [0.12, "percent", "12%"],
    [1100, "compact", "1.1K"],
    [-1234.567, "accounting", "(1,234.57)"],
    [-1234.567, "dollar", "-$1,234.57"],
    [-1234.567, "euro", "-€1,234.57"],
    [-1234.567, "yen", "-¥1,235"],
    [-1234.567, "localized", "-1,234.567"],
    [-1234.567, "plain", "-1234.567"],
    [-1234.567, "scientific", "-1.235E3"],
    [-1234.567, "engineering", "-1.235E3"],
    [1200000, "bytes", "1.2MB"],
    [1234, "bytes", "1.2KB"],
  ])(
    "formats %p with sprintf format %p to %p",
    (input: number, format: string, displayValue: string) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        format,
      })

      const cell = mockColumn.getCell(input)
      expect((cell as NumberCell).displayData).toEqual(displayValue)
    }
  )

  it.each([
    [10, "%d %d"],
    [1234567.89, "%'_,.2f"],
    [1234.5678, "%+.2E"],
    [0.000123456, "%+.2E"],
    [-0.000123456, "%+.2E"],
    [255, "%#x"],
    [4096, "%#X"],
    [42, "% d"],
    [1000, "%,.0f"],
    [25000.25, "$%,.2f"],
    [9876543210, "%,.0f"],
  ])(
    "cannot format %p using the sprintf format %p",
    (input: number, format: string) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        format,
      })

      const cell = mockColumn.getCell(input)
      expect(isErrorCell(cell)).toEqual(true)
    }
  )

  it.each([
    [10, "10"],
    [1234567, "1234567"],
    [12345.678, "12345.678"],
    [-0.000123456, "-0.000123456"],
    [null, ""],
    [undefined, ""],
  ])(
    "uses raw number for copyData so that %p is copied as %p",
    (input: number | null | undefined, expectedCopyData: string) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        format: "$%.2f",
      })

      const cell = mockColumn.getCell(input)
      expect(cell.copyData).toEqual(expectedCopyData)
    }
  )

  // Issue #11291 - st.column_config 'localized' option
  it("handles localized format for format=localized", () => {
    // Update navigator.languages for this test
    Object.defineProperty(navigator, "languages", {
      value: ["pt-BR"],
      configurable: true,
    })

    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
      format: "localized",
    })

    const cell = mockColumn.getCell(50000)
    expect((cell as NumberCell).displayData).toEqual("50.000")

    const cell2 = mockColumn.getCell(0.5)
    expect((cell2 as NumberCell).displayData).toEqual("0,5")
  })

  it("handles localized format for format=percent", () => {
    // Update navigator.languages for this test
    Object.defineProperty(navigator, "languages", {
      // Turkish displays percent sign in front
      value: ["tr-TR"],
      configurable: true,
    })

    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
      format: "percent",
    })

    const cell = mockColumn.getCell(0.5)
    expect((cell as NumberCell).displayData).toEqual("%50")
  })

  it("handles localized format for format=engineering", () => {
    // Update navigator.languages for this test
    Object.defineProperty(navigator, "languages", {
      // France displays engineering notation with comma separator
      value: ["fr-FR"],
      configurable: true,
    })

    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
      format: "scientific",
    })

    const cell = mockColumn.getCell(1234.56)
    expect((cell as NumberCell).displayData).toEqual("1,235E3")
  })

  it("handles localized format for format=euro", () => {
    // Update navigator.languages for this test
    Object.defineProperty(navigator, "languages", {
      // use locale with non-euro currency
      value: ["en-US"],
      configurable: true,
    })

    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
      format: "euro",
    })

    const cell = mockColumn.getCell(1234.56)
    expect((cell as NumberCell).displayData).toEqual("€1,234.56")
  })

  it("handles invalid localized format - falls back to default format", () => {
    // Update navigator.languages for this test
    Object.defineProperty(navigator, "languages", {
      value: ["INVALID"],
      configurable: true,
    })

    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
      format: "localized",
    })

    const cell = mockColumn.getCell(50000)
    expect((cell as NumberCell).displayData).toEqual("50,000")

    const cell2 = mockColumn.getCell(0.5)
    expect((cell2 as NumberCell).displayData).toEqual("0.5")
  })
})
