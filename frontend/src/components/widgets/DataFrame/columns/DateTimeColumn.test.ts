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

import { GridCellKind } from "@glideapps/glide-data-grid"

import { DateTimeCell } from "./cells/DateTimeCell"
import { BaseColumnProps, isErrorCell } from "./utils"
import DateTimeColumn, { DateColumn, TimeColumn } from "./DateTimeColumn"

const MOCK_DATETIME_COLUMN_TEMPLATE: BaseColumnProps = {
  id: "1",
  name: "datetime_column",
  title: "datetime_column",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "datetime",
    numpy_type: "datetime64",
  },
}

const MOCK_DATE_COLUMN_TEMPLATE: BaseColumnProps = {
  id: "1",
  name: "date_column",
  title: "date_column",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "date",
    numpy_type: "object",
  },
}

const MOCK_TIME_COLUMN_TEMPLATE: BaseColumnProps = {
  id: "1",
  name: "time_column",
  title: "time_column",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "time",
    numpy_type: "object",
  },
}

function getTodayIsoDate(): string {
  return new Date().toISOString().split("T")[0]
}

const EXAMPLE_DATE = new Date("2023-04-25T10:30:00.000Z")

describe("DateTimeColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
    expect(mockColumn.kind).toEqual("datetime")
    expect(mockColumn.title).toEqual(MOCK_DATETIME_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(MOCK_DATETIME_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(EXAMPLE_DATE)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DateTimeCell).data.date).toEqual(EXAMPLE_DATE)
  })

  it.each([
    // valid date object
    [new Date("2023-04-25"), "2023-04-25T00:00:00.000"],
    // undefined value
    [undefined, null],
    // null value
    [null, null],
    // empty string
    ["", null],
    // valid date string
    ["2023-04-25", "2023-04-25T00:00:00.000"],
    // valid unix timestamp
    [1671951600000, "2022-12-25T07:00:00.000"],
    // valid bigint
    [BigInt(1671951600000000), "2022-12-25T07:00:00.000"],
    // other date formats:
    ["04/25/2023", "2023-04-25T00:00:00.000"],
    // valid ISO date string
    ["2023-04-25T10:30:00.000Z", "2023-04-25T10:30:00.000"],
    // valid date string with time
    ["2023-04-25 10:30", "2023-04-25T10:30:00.000"],
    // valid date string with timezone
    ["2023-04-25T10:30:00.000+02:00", "2023-04-25T08:30:00.000"],
    // valid time string
    ["10:30", getTodayIsoDate() + "T10:30:00.000"],
    // valid time string with milliseconds
    ["10:30:25.123", getTodayIsoDate() + "T10:30:25.123"],
    // valid time string with seconds
    ["10:30:25", getTodayIsoDate() + "T10:30:25.000"],
    // valid month string
    ["Jan 2023", "2023-01-01T00:00:00.000"],
    // valid month string with day
    ["Jan 15, 2023", "2023-01-15T00:00:00.000"],
    // valid date string with day and month names
    ["25 April 2023", "2023-04-25T00:00:00.000"],
    // valid date string with day and short month names
    ["25 Apr 2023", "2023-04-25T00:00:00.000"],
    // valid date string with short day and month names
    ["Tue, 25 Apr 2023", "2023-04-25T00:00:00.000"],
    // valid date string with time and AM/PM
    ["2023-04-25 10:30 AM", "2023-04-25T10:30:00.000"],
    // valid Unix timestamp in milliseconds as a string
    ["1671951600000", "2022-12-25T07:00:00.000"],
  ])(
    "supports datetime-compatible value (%p parsed as %p)",
    (input: any, value: string | null) => {
      const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([[NaN], ["foo"]])("%p results in error cell", (input: any) => {
    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })

  it("respects min_value config option", () => {
    const MOCK_DATETIME_COLUMN_WITH_MIN: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        min_value: "2023-04-24T00:00:00",
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_MIN)
    const minValue = new Date("2023-04-24T00:00:00.000Z")
    const belowMinValue = new Date("2023-04-23T23:59:59.000Z")
    const aboveMinValue = new Date("2023-04-25T23:59:59.000Z")

    // Check valid values
    const minCell = mockColumn.getCell(minValue, true)
    expect(mockColumn.validateInput!(minValue)).toBeTruthy()
    expect(mockColumn.getCellValue(minCell)).toEqual("2023-04-24T00:00:00.000")

    const aboveMinValueCell = mockColumn.getCell(aboveMinValue, true)
    expect(mockColumn.validateInput!(aboveMinValue)).toBeTruthy()
    expect(mockColumn.getCellValue(aboveMinValueCell)).toEqual(
      "2023-04-25T23:59:59.000"
    )

    // Check invalid values
    const belowMinCell = mockColumn.getCell(belowMinValue, true)
    expect(mockColumn.validateInput!(belowMinValue)).toBeFalsy()
    expect(isErrorCell(belowMinCell)).toEqual(true)
  })

  it("respects max_value config option", () => {
    const MOCK_DATETIME_COLUMN_WITH_MAX: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        max_value: "2023-04-24T00:00:00",
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_MAX)
    const maxValue = new Date("2023-04-24T00:00:00.000Z")
    const belowMaxValue = new Date("2023-04-23T23:59:59.000Z")
    const aboveMaxValue = new Date("2023-04-25T23:59:59.000Z")

    // Check valid values
    const maxCell = mockColumn.getCell(maxValue, true)
    expect(mockColumn.validateInput!(maxValue)).toBeTruthy()
    expect(mockColumn.getCellValue(maxCell)).toEqual("2023-04-24T00:00:00.000")

    const belowMaxValueCell = mockColumn.getCell(belowMaxValue, true)
    expect(mockColumn.validateInput!(belowMaxValue)).toBeTruthy()
    expect(mockColumn.getCellValue(belowMaxValueCell)).toEqual(
      "2023-04-23T23:59:59.000"
    )

    // Check invalid values
    const aboveMaxCell = mockColumn.getCell(aboveMaxValue, true)
    expect(mockColumn.validateInput!(aboveMaxValue)).toBeFalsy()
    expect(isErrorCell(aboveMaxCell)).toEqual(true)
  })

  it("changes the step size based on the config option", () => {
    const MOCK_DATETIME_COLUMN_WITH_STEP: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        step: 60,
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_STEP)
    const newCell = mockColumn.getCell(EXAMPLE_DATE)
    expect((newCell as DateTimeCell).data.step).toBe("60")
  })
})

describe("DateColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = DateColumn(MOCK_DATE_COLUMN_TEMPLATE)
    expect(mockColumn.kind).toEqual("date")
    expect(mockColumn.title).toEqual(MOCK_DATE_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(MOCK_DATE_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(EXAMPLE_DATE)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DateTimeCell).copyData).toEqual("2023-04-25")
  })

  it.each([
    // valid date object
    [new Date("2023-04-25"), "2023-04-25"],
    // undefined value
    [undefined, null],
    // null value
    [null, null],
    // empty string
    ["", null],
    // valid date string
    ["2023-04-25", "2023-04-25"],
    // valid unix timestamp
    [1671951600000, "2022-12-25"],
    // valid bigint
    [BigInt(1671951600000000), "2022-12-25"],
    // other date formats:
    ["04/25/2023", "2023-04-25"],
    // valid ISO date string
    ["2023-04-25T10:30:00.000Z", "2023-04-25"],
    // valid date string with time
    ["2023-04-25 10:30", "2023-04-25"],
    // valid date string with timezone
    ["2023-04-25T10:30:00.000+02:00", "2023-04-25"],
    // valid time string
    ["10:30", getTodayIsoDate()],
    // valid time string with milliseconds
    ["10:30:25.123", getTodayIsoDate()],
    // valid time string with seconds
    ["10:30:25", getTodayIsoDate()],
    // valid month string
    ["Jan 2023", "2023-01-01"],
    // valid month string with day
    ["Jan 15, 2023", "2023-01-15"],
    // valid date string with day and month names
    ["25 April 2023", "2023-04-25"],
    // valid date string with day and short month names
    ["25 Apr 2023", "2023-04-25"],
    // valid date string with short day and month names
    ["Tue, 25 Apr 2023", "2023-04-25"],
    // valid date string with time and AM/PM
    ["2023-04-25 10:30 AM", "2023-04-25"],
    // valid Unix timestamp in milliseconds as a string
    ["1671951600000", "2022-12-25"],
  ])(
    "supports date-compatible value (%p parsed as %p)",
    (input: any, value: string | null) => {
      const mockColumn = DateColumn(MOCK_DATE_COLUMN_TEMPLATE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([[NaN], ["foo"]])("%p results in error cell", (input: any) => {
    const mockColumn = DateColumn(MOCK_DATE_COLUMN_TEMPLATE)
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })

  it("respects min_value config option", () => {
    const MOCK_DATE_COLUMN_TEMPLATE_WITH_MIN: BaseColumnProps = {
      ...MOCK_DATE_COLUMN_TEMPLATE,
      columnTypeOptions: {
        min_value: "2023-04-24",
      },
    }

    const mockColumn = DateColumn(MOCK_DATE_COLUMN_TEMPLATE_WITH_MIN)
    const minValue = new Date("2023-04-24")
    const belowMinValue = new Date("2023-04-23")
    const aboveMinValue = new Date("2023-04-25")

    // Check valid values
    const minCell = mockColumn.getCell(minValue, true)
    expect(mockColumn.validateInput!(minValue)).toBeTruthy()
    expect(mockColumn.getCellValue(minCell)).toEqual("2023-04-24")

    const aboveMinValueCell = mockColumn.getCell(aboveMinValue, true)
    expect(mockColumn.validateInput!(aboveMinValue)).toBeTruthy()
    expect(mockColumn.getCellValue(aboveMinValueCell)).toEqual("2023-04-25")

    // Check invalid values
    const belowMinCell = mockColumn.getCell(belowMinValue, true)
    expect(mockColumn.validateInput!(belowMinValue)).toBeFalsy()
    expect(isErrorCell(belowMinCell)).toEqual(true)
  })

  it("respects max_value config option", () => {
    const MOCK_DATE_COLUMN_TEMPLATE_WITH_MAX: BaseColumnProps = {
      ...MOCK_DATE_COLUMN_TEMPLATE,
      columnTypeOptions: {
        max_value: "2023-04-24",
      },
    }

    const mockColumn = DateColumn(MOCK_DATE_COLUMN_TEMPLATE_WITH_MAX)
    const maxValue = new Date("2023-04-24")
    const belowMaxValue = new Date("2023-04-23")
    const aboveMaxValue = new Date("2023-04-25")

    // Check valid values
    const maxCell = mockColumn.getCell(maxValue, true)
    expect(mockColumn.validateInput!(maxValue)).toBeTruthy()
    expect(mockColumn.getCellValue(maxCell)).toEqual("2023-04-24")

    const belowMaxValueCell = mockColumn.getCell(belowMaxValue, true)
    expect(mockColumn.validateInput!(belowMaxValue)).toBeTruthy()
    expect(mockColumn.getCellValue(belowMaxValueCell)).toEqual("2023-04-23")

    // Check invalid values
    const aboveMaxCell = mockColumn.getCell(aboveMaxValue, true)
    expect(mockColumn.validateInput!(aboveMaxValue)).toBeFalsy()
    expect(isErrorCell(aboveMaxCell)).toEqual(true)
  })

  it("changes the step size based on the config option", () => {
    const MOCK_DATE_COLUMN_WITH_STEP: BaseColumnProps = {
      ...MOCK_DATE_COLUMN_TEMPLATE,
      columnTypeOptions: {
        step: 2,
      },
    }

    const mockColumn = DateColumn(MOCK_DATE_COLUMN_WITH_STEP)
    const newCell = mockColumn.getCell(EXAMPLE_DATE)
    expect((newCell as DateTimeCell).data.step).toBe("2")
  })
})

describe("TimeColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = TimeColumn(MOCK_TIME_COLUMN_TEMPLATE)
    expect(mockColumn.kind).toEqual("time")
    expect(mockColumn.title).toEqual(MOCK_TIME_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(MOCK_TIME_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(EXAMPLE_DATE)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DateTimeCell).copyData).toEqual("10:30:00.000")
  })

  it.each([
    // valid date object
    [new Date("2023-04-25"), "00:00:00.000"],
    // undefined value
    [undefined, null],
    // null value
    [null, null],
    // empty string
    ["", null],
    // valid date string
    ["2023-04-25", "00:00:00.000"],
    // valid unix timestamp
    [1671951600000, "07:00:00.000"],
    // valid bigint
    [BigInt(1671951600000000), "07:00:00.000"],
    // other date formats:
    ["04/25/2023", "00:00:00.000"],
    // valid ISO date string
    ["2023-04-25T10:30:00.000Z", "10:30:00.000"],
    // valid date string with time
    ["2023-04-25 10:30", "10:30:00.000"],
    // valid date string with timezone
    ["2023-04-25T10:30:00.000+02:00", "08:30:00.000"],
    // valid time string
    ["10:30", "10:30:00.000"],
    // valid time string with milliseconds
    ["10:30:25.123", "10:30:25.123"],
    // valid time string with seconds
    ["10:30:25", "10:30:25.000"],
    // valid month string
    ["Jan 2023", "00:00:00.000"],
    // valid date string with day and month names
    ["25 April 2023", "00:00:00.000"],
    // valid date string with short day and month names
    ["Tue, 25 Apr 2023", "00:00:00.000"],
    // valid date string with time and AM/PM
    ["2023-04-25 10:30 AM", "10:30:00.000"],
    // valid Unix timestamp in milliseconds as a string
    ["1671951600000", "07:00:00.000"],
  ])(
    "supports time-compatible value (%p parsed as %p)",
    (input: any, value: string | null) => {
      const mockColumn = TimeColumn(MOCK_TIME_COLUMN_TEMPLATE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([[NaN], ["foo"]])("%p results in error cell", (input: any) => {
    const mockColumn = TimeColumn(MOCK_TIME_COLUMN_TEMPLATE)
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })

  it("respects min_value config option", () => {
    const MOCK_TIME_COLUMN_TEMPLATE_WITH_MIN: BaseColumnProps = {
      ...MOCK_TIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        min_value: "10:59:59",
      },
    }

    const mockColumn = TimeColumn(MOCK_TIME_COLUMN_TEMPLATE_WITH_MIN)
    const minValue = "10:59:59.000"
    const belowMinValue = "10:59:58.345"
    const aboveMinValue = "11:00:00.123"

    // Check valid values
    const minCell = mockColumn.getCell(minValue, true)
    expect(mockColumn.getCellValue(minCell)).toEqual("10:59:59.000")
    expect(mockColumn.validateInput!(minValue)).toBeTruthy()

    const aboveMinValueCell = mockColumn.getCell(aboveMinValue, true)
    expect(mockColumn.getCellValue(aboveMinValueCell)).toEqual("11:00:00.123")
    expect(mockColumn.validateInput!(aboveMinValue)).toBeTruthy()

    // Check invalid values
    const belowMinCell = mockColumn.getCell(belowMinValue, true)
    expect(mockColumn.validateInput!(belowMinValue)).toBeFalsy()
    expect(isErrorCell(belowMinCell)).toEqual(true)
  })

  it("respects max_value config option", () => {
    const MOCK_TIME_COLUMN_TEMPLATE_WITH_MAX: BaseColumnProps = {
      ...MOCK_TIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        max_value: "10:59:59",
      },
    }

    const mockColumn = TimeColumn(MOCK_TIME_COLUMN_TEMPLATE_WITH_MAX)
    const maxValue = "10:59:59.000"
    const belowMaxValue = "10:59:58.345"
    const aboveMaxValue = "11:00:00.123"

    // Check valid values
    const maxCell = mockColumn.getCell(maxValue, true)
    expect(mockColumn.getCellValue(maxCell)).toEqual("10:59:59.000")
    expect(mockColumn.validateInput!(maxValue)).toBeTruthy()

    const belowMaxValueCell = mockColumn.getCell(belowMaxValue, true)
    expect(mockColumn.validateInput!(belowMaxValue)).toBeTruthy()
    expect(mockColumn.getCellValue(belowMaxValueCell)).toEqual("10:59:58.345")

    // Check invalid values
    const aboveMaxCell = mockColumn.getCell(aboveMaxValue, true)
    expect(mockColumn.validateInput!(aboveMaxValue)).toBeFalsy()
    expect(isErrorCell(aboveMaxCell)).toEqual(true)
  })

  it("changes the step size based on the config option", () => {
    const MOCK_TIME_COLUMN_WITH_STEP: BaseColumnProps = {
      ...MOCK_TIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        step: 60,
      },
    }

    const mockColumn = TimeColumn(MOCK_TIME_COLUMN_WITH_STEP)
    const newCell = mockColumn.getCell(EXAMPLE_DATE)
    expect((newCell as DateTimeCell).data.step).toBe("60")
  })
})
