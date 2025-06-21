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
  Bool,
  Decimal,
  Duration,
  Field,
  Float64,
  Int64,
  LargeBinary,
  LargeUtf8,
  List,
  makeVector,
  Null,
  Time,
  Timestamp,
  TimeUnit,
  Utf8,
} from "apache-arrow"

import { Quiver } from "~lib/dataframes/Quiver"
import {
  CATEGORICAL,
  DATE,
  DECIMAL,
  DICTIONARY,
  FLOAT64,
  INT64,
  INTERVAL_DATETIME64,
  INTERVAL_FLOAT64,
  INTERVAL_INT64,
  INTERVAL_UINT64,
  PERIOD,
  RANGE,
  TIMEDELTA,
  UINT64,
  UNICODE,
} from "~lib/mocks/arrow"

import {
  ArrowType,
  convertVectorToList,
  DataFrameCellType,
  getPandasTypeName,
  getTimezone,
  isBooleanType,
  isBytesType,
  isDatetimeType,
  isDecimalType,
  isDurationType,
  isEmptyType,
  isFloatType,
  isIntegerType,
  isIntervalType,
  isListType,
  isNumericType,
  isPeriodType,
  isRangeIndexType,
  isStringType,
  isTimeType,
  isUnsignedIntegerType,
} from "./arrowTypeUtils"

describe("getTypeName", () => {
  describe("uses numpy_type", () => {
    test("period", () => {
      const mockElement = { data: PERIOD }
      const q = new Quiver(mockElement)
      const dataType = q.columnTypes[1]

      expect(getPandasTypeName(dataType)).toEqual("period[Y-DEC]")
    })

    test("decimal", () => {
      const mockElement = { data: DECIMAL }
      const q = new Quiver(mockElement)
      const firstColumnType = q.columnTypes[1]

      expect(getPandasTypeName(firstColumnType)).toEqual("decimal")
    })

    test("timedelta", () => {
      const mockElement = { data: TIMEDELTA }
      const q = new Quiver(mockElement)
      const firstColumnType = q.columnTypes[1]

      expect(getPandasTypeName(firstColumnType)).toEqual("timedelta64[ns]")
    })

    test("dictionary", () => {
      const mockElement = { data: DICTIONARY }
      const q = new Quiver(mockElement)
      const firstColumnType = q.columnTypes[1]

      expect(getPandasTypeName(firstColumnType)).toEqual("object")
    })

    test("interval datetime64[ns]", () => {
      const mockElement = { data: INTERVAL_DATETIME64 }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual(
        "interval[datetime64[ns], right]"
      )
    })

    test("interval float64", () => {
      const mockElement = { data: INTERVAL_FLOAT64 }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("interval[float64, right]")
    })

    test("interval int64", () => {
      const mockElement = { data: INTERVAL_INT64 }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("interval[int64, right]")
    })

    test("interval uint64", () => {
      const mockElement = { data: INTERVAL_UINT64 }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("interval[uint64, right]")
    })
  })

  describe("uses pandas_type", () => {
    test("categorical", () => {
      const mockElement = { data: CATEGORICAL }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("categorical")
    })

    test("date", () => {
      const mockElement = { data: DATE }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("datetime")
    })

    test("float64", () => {
      const mockElement = { data: FLOAT64 }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("float64")
    })

    test("int64", () => {
      const mockElement = { data: INT64 }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("int64")
    })

    test("range", () => {
      const mockElement = { data: RANGE }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("range")
    })

    test("uint64", () => {
      const mockElement = { data: UINT64 }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("uint64")
    })

    test("unicode", () => {
      const mockElement = { data: UNICODE }
      const q = new Quiver(mockElement)
      const indexType = q.columnTypes[0]

      expect(getPandasTypeName(indexType)).toEqual("unicode")
    })
  })

  it("returns the correct type name for PERIOD", () => {
    const arrowType: ArrowType = {
      type: DataFrameCellType.DATA,
      arrowField: new Field("c1", new Utf8(), true),
      pandasType: {
        field_name: "c1",
        name: "c1",
        pandas_type: "period[M]",
        numpy_type: "period[M]",
        metadata: null,
      },
      categoricalOptions: undefined,
    }
    expect(getPandasTypeName(arrowType)).toBe("period[M]")
  })

  it("returns the correct type name for DECIMAL", () => {
    const arrowType: ArrowType = {
      type: DataFrameCellType.DATA,
      arrowField: new Field("c1", new Utf8(), true),
      pandasType: {
        field_name: "c1",
        name: "c1",
        pandas_type: "decimal",
        numpy_type: "object",
        metadata: null,
      },
      categoricalOptions: undefined,
    }
    expect(getPandasTypeName(arrowType)).toBe("decimal")
  })
})

describe("isIntegerType", () => {
  it.each([
    [undefined, false],
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
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "int16",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "range",
          numpy_type: "range",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "uint64",
          numpy_type: "uint64",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Bool(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bool",
          numpy_type: "bool",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "interval[int64, both]",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as integer type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isIntegerType(arrowType)).toEqual(expected)
    }
  )
})

describe("isUnsignedIntegerType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "float64",
          numpy_type: "float64",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "uint64",
          numpy_type: "uint64",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "uint16",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bool",
          numpy_type: "bool",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "categorical",
          numpy_type: "uint8",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as unsigned integer type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isUnsignedIntegerType(arrowType)).toEqual(expected)
    }
  )
})

describe("isBooleanType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Bool(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bool",
          numpy_type: "bool",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Bool(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "bool",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      false,
    ],
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
      },
      false,
    ],
  ])(
    "interprets %s as boolean type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isBooleanType(arrowType)).toEqual(expected)
    }
  )
})

describe("getTimezone", () => {
  it.each([
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Timestamp(TimeUnit.SECOND, "UTC"),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: { timezone: "UTC" },
        },
      },
      "UTC",
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: { timezone: "America/New_York" },
        },
      },
      "America/New_York",
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Timestamp(TimeUnit.SECOND, "America/New_York"),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: null,
        },
      },
      "America/New_York",
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: {},
        },
      },
      undefined,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: {},
        },
      },
      undefined,
    ],
  ])(
    "returns correct timezone for %o",
    (arrowType: ArrowType, expected: string | undefined) => {
      expect(getTimezone(arrowType)).toEqual(expected)
    }
  )
})

describe("isFloatType", () => {
  it.each([
    [undefined, false],
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
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Float64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "float32",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Bool(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bool",
          numpy_type: "bool",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as float type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isFloatType(arrowType)).toEqual(expected)
    }
  )
})

describe("isDecimalType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Decimal(10, 2), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "decimal",
          metadata: null,
        },
      },
      true,
    ],
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
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as decimal type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isDecimalType(arrowType)).toEqual(expected)
    }
  )
})

describe("isNumericType", () => {
  it.each([
    [undefined, false],
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
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Decimal(10, 2), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "decimal",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "uint64",
          numpy_type: "uint64",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Bool(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bool",
          numpy_type: "bool",
          metadata: null,
        },
      },
      false,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as numeric type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isNumericType(arrowType)).toEqual(expected)
    }
  )
})

describe("convertVectorToList", () => {
  it("converts vector to list", () => {
    const vector = makeVector(Int32Array.from([1, 2, 3]))
    const expected = [1, 2, 3]
    expect(convertVectorToList(vector)).toEqual(expected)
  })
})

describe("isDatetimeType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[s]",
          metadata: null,
        },
      },
      true,
    ],
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
      },
      false,
    ],
  ])(
    "interprets %s as datetime type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isDatetimeType(arrowType)).toEqual(expected)
    }
  )
})

describe("isTimeType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Time(TimeUnit.SECOND, 64), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "time",
          numpy_type: "time",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Time(TimeUnit.SECOND, 64), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "time",
          numpy_type: "time",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as time type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isTimeType(arrowType)).toEqual(expected)
    }
  )
})

describe("isListType", () => {
  it.each([
    [undefined, false],
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
          pandas_type: "object",
          numpy_type: "list[int64]",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new List(new Field("test", new Utf8(), true)),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "list[str]",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "datetime",
          numpy_type: "datetime64[ns]",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as list type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isListType(arrowType)).toEqual(expected)
    }
  )
})

describe("isDurationType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Duration(TimeUnit.SECOND), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "timedelta",
          numpy_type: "timedelta64[ns]",
          metadata: null,
        },
      },
      true,
    ],
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
      },
      false,
    ],
  ])(
    "interprets %s as duration type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isDurationType(arrowType)).toEqual(expected)
    }
  )
})

describe("isPeriodType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Int64(),
          true,
          new Map([["ARROW:extension:name", "period"]])
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "period[M]",
          numpy_type: "period[M]",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as period type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isPeriodType(arrowType)).toEqual(expected)
    }
  )
})

describe("isBytesType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Binary(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bytes",
          numpy_type: "bytes",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new LargeBinary(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bytes",
          numpy_type: "bytes",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as bytes type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isBytesType(arrowType)).toEqual(expected)
    }
  )
})

describe("isStringType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new LargeUtf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "large_string[pyarrow]",
          numpy_type: "object",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Binary(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bytes",
          numpy_type: "bytes",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as string type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isStringType(arrowType)).toEqual(expected)
    }
  )
})

describe("isEmptyType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Null(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "empty",
          numpy_type: "object",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as empty type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isEmptyType(arrowType)).toEqual(expected)
    }
  )
})

describe("isIntervalType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Int64(),
          true,
          new Map([["ARROW:extension:name", "interval"]])
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "interval",
          numpy_type: "interval[int64]",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as interval type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isIntervalType(arrowType)).toEqual(expected)
    }
  )
})

describe("isRangeIndexType", () => {
  it.each([
    [undefined, false],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "range",
          numpy_type: "range",
          metadata: null,
        },
      },
      true,
    ],
    [
      {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      false,
    ],
  ])(
    "interprets %s as range index type: %s",
    (arrowType: ArrowType | undefined, expected: boolean) => {
      expect(isRangeIndexType(arrowType)).toEqual(expected)
    }
  )
})
