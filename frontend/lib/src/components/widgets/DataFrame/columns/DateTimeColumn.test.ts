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

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

import { GridCellKind } from "@glideapps/glide-data-grid"
import { DatePickerType } from "@glideapps/glide-data-grid-cells"
import { DateDay, Field, Time, Timestamp, TimeUnit } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import DateTimeColumn, { DateColumn, TimeColumn } from "./DateTimeColumn"
import { BaseColumnProps, isErrorCell } from "./utils"

const MOCK_DATETIME_COLUMN_TEMPLATE: BaseColumnProps = {
  id: "1",
  name: "datetime_column",
  title: "datetime_column",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
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
      numpy_type: "datetime64",
      metadata: null,
    },
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
  isPinned: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    type: DataFrameCellType.DATA,
    arrowField: new Field("date_column", new DateDay(), true),
    pandasType: {
      field_name: "date_column",
      name: "date_column",
      pandas_type: "date",
      numpy_type: "object",
      metadata: null,
    },
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
  isPinned: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    type: DataFrameCellType.DATA,
    arrowField: new Field("time_column", new Time(TimeUnit.SECOND, 64), true),
    pandasType: {
      field_name: "time_column",
      name: "time_column",
      pandas_type: "time",
      numpy_type: "object",
      metadata: null,
    },
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
    expect((mockCell as DatePickerType).data.date).toEqual(EXAMPLE_DATE)
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
    [1671951600, "2022-12-25T07:00:00.000"],
    // valid bigint
    [BigInt(1671951600), "2022-12-25T07:00:00.000"],
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
    ["1671951600", "2022-12-25T07:00:00.000"],
  ])(
    "supports datetime-compatible value (%p parsed as %p)",
    (input: unknown, value: string | null) => {
      const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([[NaN], ["foo"]])("%p results in error cell", (input: unknown) => {
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
    expect((newCell as DatePickerType).data.step).toBe("60")
  })

  it("formats according to the provided format config option", () => {
    const MOCK_DATETIME_COLUMN_CUSTOM_FORMAT = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        format: "MMM Do, YYYY - HH:mm",
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_CUSTOM_FORMAT)
    const cell = mockColumn.getCell(EXAMPLE_DATE)
    expect((cell as DatePickerType).data.displayDate).toEqual(
      "Apr 25th, 2023 - 10:30"
    )
  })

  it("supports columns with timezone", () => {
    const MOCK_DATETIME_COLUMN_TEMPLATE_WITH_TIMEZONE: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      arrowType: {
        ...MOCK_DATETIME_COLUMN_TEMPLATE.arrowType,
        pandasType: {
          ...MOCK_DATETIME_COLUMN_TEMPLATE.arrowType.pandasType!,
          metadata: { timezone: "+05:00" },
        },
      },
    }

    const mockColumn = DateTimeColumn(
      MOCK_DATETIME_COLUMN_TEMPLATE_WITH_TIMEZONE
    )
    const mockCell = mockColumn.getCell(EXAMPLE_DATE)
    expect((mockCell as DatePickerType).data.date).toEqual(EXAMPLE_DATE)
    expect((mockCell as DatePickerType).data.displayDate).toEqual(
      "2023-04-25 15:30:00+05:00"
    )
    expect((mockCell as DatePickerType).data.timezoneOffset).toEqual(300)
  })

  it("supports columns with named timezone (e.g., America/New_York)", () => {
    const MOCK_DATETIME_COLUMN_TEMPLATE_WITH_NAMED_TZ: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      arrowType: {
        ...MOCK_DATETIME_COLUMN_TEMPLATE.arrowType,
        pandasType: {
          ...MOCK_DATETIME_COLUMN_TEMPLATE.arrowType.pandasType!,
          metadata: { timezone: "America/New_York" },
        },
      },
    }

    const mockColumn = DateTimeColumn(
      MOCK_DATETIME_COLUMN_TEMPLATE_WITH_NAMED_TZ
    )
    const mockCell = mockColumn.getCell(EXAMPLE_DATE)
    expect((mockCell as DatePickerType).data.date).toEqual(EXAMPLE_DATE)
    // America/New_York in April is EDT (UTC-4)
    expect((mockCell as DatePickerType).data.displayDate).toEqual(
      "2023-04-25 06:30:00-04:00"
    )
  })

  it("supports user-configured timezone in columnTypeOptions", () => {
    const MOCK_DATETIME_COLUMN_WITH_USER_TZ: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        timezone: "UTC",
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_USER_TZ)
    const mockCell = mockColumn.getCell(EXAMPLE_DATE)
    expect((mockCell as DatePickerType).data.displayDate).toEqual(
      "2023-04-25 10:30:00+00:00"
    )
  })

  it("returns false for validateInput when value is null and column is required", () => {
    const MOCK_DATETIME_COLUMN_REQUIRED: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      isRequired: true,
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_REQUIRED)
    expect(mockColumn.validateInput!(null)).toBe(false)
    expect(mockColumn.validateInput!(undefined)).toBe(false)
    expect(mockColumn.validateInput!("")).toBe(false)
  })

  it("returns true for validateInput when value is null and column is not required", () => {
    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
    expect(mockColumn.validateInput!(null)).toBe(true)
    expect(mockColumn.validateInput!(undefined)).toBe(true)
    expect(mockColumn.validateInput!("")).toBe(true)
  })

  it("returns false for validateInput when value cannot be interpreted as date", () => {
    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
    expect(mockColumn.validateInput!("not-a-date")).toBe(false)
    expect(mockColumn.validateInput!(NaN)).toBe(false)
  })

  it("adapts default format based on step size >= 60", () => {
    const MOCK_DATETIME_COLUMN_WITH_STEP: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        step: 60,
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_STEP)
    const newCell = mockColumn.getCell(EXAMPLE_DATE)
    // With step >= 60, format should omit seconds
    expect((newCell as DatePickerType).data.displayDate).toBe(
      "2023-04-25 10:30"
    )
  })

  it("adapts default format based on step size < 1 (milliseconds)", () => {
    const MOCK_DATETIME_COLUMN_WITH_MS_STEP: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        step: 0.001,
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_MS_STEP)
    const newCell = mockColumn.getCell(EXAMPLE_DATE)
    // With step < 1, format should include milliseconds
    expect((newCell as DatePickerType).data.displayDate).toBe(
      "2023-04-25 10:30:00.000"
    )
  })

  it("includes Z suffix for datetime with timezone", () => {
    const MOCK_DATETIME_COLUMN_WITH_TZ: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        timezone: "UTC",
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_TZ)
    const cell = mockColumn.getCell(EXAMPLE_DATE)
    // copyData should have Z suffix for timezone-aware datetimes
    expect((cell as DatePickerType).copyData).toEqual(
      "2023-04-25 10:30:00+00:00"
    )
  })

  it("returns ISO string with Z suffix from getCellValue for timezone-aware columns", () => {
    const MOCK_DATETIME_COLUMN_WITH_TZ: BaseColumnProps = {
      ...MOCK_DATETIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        timezone: "UTC",
      },
    }

    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_WITH_TZ)
    const cell = mockColumn.getCell(EXAMPLE_DATE)
    // getCellValue should return ISO string with Z suffix
    expect(mockColumn.getCellValue(cell)).toEqual("2023-04-25T10:30:00.000Z")
  })
})

describe("DateColumn", () => {
  afterEach(() => {
    // Restore original value after each test
    Object.defineProperty(navigator, "languages", {
      value: navigator.languages,
      configurable: true,
    })
  })

  it("creates a valid column instance", () => {
    const mockColumn = DateColumn(MOCK_DATE_COLUMN_TEMPLATE)
    expect(mockColumn.kind).toEqual("date")
    expect(mockColumn.title).toEqual(MOCK_DATE_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(MOCK_DATE_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(EXAMPLE_DATE)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DatePickerType).copyData).toEqual("2023-04-25")
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
    [1671951600, "2022-12-25"],
    // valid bigint
    [BigInt(1671951600), "2022-12-25"],
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
    // valid Unix timestamp in seconds as a string
    ["1671951600", "2022-12-25"],
  ])(
    "supports date-compatible value (%p parsed as %p)",
    (input: unknown, value: string | null) => {
      const mockColumn = DateColumn(MOCK_DATE_COLUMN_TEMPLATE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([[NaN], ["foo"]])("%p results in error cell", (input: unknown) => {
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
    expect((newCell as DatePickerType).data.step).toBe("2")
  })

  it("formats according to the provided format config option", () => {
    const MOCK_DATE_COLUMN_CUSTOM_FORMAT = {
      ...MOCK_DATE_COLUMN_TEMPLATE,
      columnTypeOptions: {
        format: "MMM Do, YYYY",
      },
    }

    const mockColumn = DateColumn(MOCK_DATE_COLUMN_CUSTOM_FORMAT)
    const cell = mockColumn.getCell(EXAMPLE_DATE)
    expect((cell as DatePickerType).data.displayDate).toEqual("Apr 25th, 2023")
  })

  // Issue #11291 - st.column_config 'localized' option
  it("handles localized format", () => {
    // Update navigator.languages for this test
    Object.defineProperty(navigator, "languages", {
      value: ["pt-BR"],
      configurable: true,
    })

    const MOCK_DATE_COLUMN_CUSTOM_FORMAT = {
      ...MOCK_DATE_COLUMN_TEMPLATE,
      columnTypeOptions: {
        format: "localized",
      },
    }

    const mockColumn = DateColumn(MOCK_DATE_COLUMN_CUSTOM_FORMAT)
    const cell = mockColumn.getCell(EXAMPLE_DATE)
    expect((cell as DatePickerType).data.displayDate).toEqual(
      "25 de abr. de 2023"
    )
  })

  it("handles invalid localized format - falls back to default format", () => {
    // Update navigator.languages to return an invalid locale for this test
    Object.defineProperty(navigator, "languages", {
      value: ["INVALID"],
      configurable: true,
    })

    const MOCK_DATE_COLUMN_CUSTOM_FORMAT = {
      ...MOCK_DATE_COLUMN_TEMPLATE,
      columnTypeOptions: {
        format: "localized",
      },
    }

    const mockColumn = DateColumn(MOCK_DATE_COLUMN_CUSTOM_FORMAT)
    const cell = mockColumn.getCell(EXAMPLE_DATE)
    expect((cell as DatePickerType).data.displayDate).toEqual("Apr 25, 2023")
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
    expect((mockCell as DatePickerType).copyData).toEqual("10:30:00")
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
    [1671951600, "07:00:00.000"],
    // valid bigint
    [BigInt(1671951600), "07:00:00.000"],
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
    ["1671951600", "07:00:00.000"],
  ])(
    "supports time-compatible value (%p parsed as %p)",
    (input: unknown, value: string | null) => {
      const mockColumn = TimeColumn(MOCK_TIME_COLUMN_TEMPLATE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([[NaN], ["foo"]])("%p results in error cell", (input: unknown) => {
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
    expect((newCell as DatePickerType).data.step).toBe("60")
  })

  it("formats according to the provided format config option", () => {
    const MOCK_TIME_COLUMN_CUSTOM_FORMAT = {
      ...MOCK_TIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        format: "HH:mm",
      },
    }

    const mockColumn = DateColumn(MOCK_TIME_COLUMN_CUSTOM_FORMAT)
    const cell = mockColumn.getCell(EXAMPLE_DATE)
    expect((cell as DatePickerType).data.displayDate).toEqual("10:30")
  })

  it("adapts default format based on step size", () => {
    const MOCK_TIME_COLUMN_WITH_STEP: BaseColumnProps = {
      ...MOCK_TIME_COLUMN_TEMPLATE,
      columnTypeOptions: {
        step: 60,
      },
    }

    const mockColumn = TimeColumn(MOCK_TIME_COLUMN_WITH_STEP)
    const newCell = mockColumn.getCell(EXAMPLE_DATE)
    expect((newCell as DatePickerType).data.displayDate).toBe("10:30")
  })
})
