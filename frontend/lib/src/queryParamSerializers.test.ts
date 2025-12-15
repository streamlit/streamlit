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

import { describe, expect, it } from "vitest"

import {
  deserializeBool,
  deserializeColor,
  deserializeDate,
  deserializeDateRange,
  deserializeNumber,
  deserializeNumberRange,
  deserializeString,
  deserializeTime,
  extractQueryParamName,
  getLastValue,
  isQueryParamKey,
  QUERY_PARAM_KEY_PREFIX,
  serializeBool,
  serializeColor,
  serializeDate,
  serializeDateRange,
  serializeNumber,
  serializeNumberRange,
  serializeString,
  serializeTime,
} from "./queryParamSerializers"

describe("Boolean serializers", () => {
  describe("serializeBool", () => {
    it.each([
      [true, "true"],
      [false, "false"],
    ])("serializes %s to '%s'", (input, expected) => {
      expect(serializeBool(input)).toBe(expected)
    })
  })

  describe("deserializeBool", () => {
    it.each([
      ["true", true],
      ["TRUE", true],
      ["True", true],
      ["1", true],
      ["yes", true],
      ["on", true],
      ["false", false],
      ["FALSE", false],
      ["0", false],
      ["no", false],
      ["off", false],
      ["", false],
      ["random", false],
    ])("deserializes '%s' to %s", (input, expected) => {
      expect(deserializeBool(input)).toBe(expected)
    })

    it("returns false for null", () => {
      expect(deserializeBool(null)).toBe(false)
    })

    it("uses last value from array", () => {
      expect(deserializeBool(["false", "true"])).toBe(true)
      expect(deserializeBool(["true", "false"])).toBe(false)
    })

    it("returns false for empty array", () => {
      expect(deserializeBool([])).toBe(false)
    })
  })
})

describe("String serializers", () => {
  describe("serializeString", () => {
    it.each([
      ["hello", "hello"],
      ["", ""],
      [null, ""],
      ["hello world", "hello world"],
      ["日本語", "日本語"],
    ])("serializes %s to '%s'", (input, expected) => {
      expect(serializeString(input)).toBe(expected)
    })
  })

  describe("deserializeString", () => {
    it.each([
      ["hello", "hello"],
      ["", ""],
    ])("deserializes '%s' to '%s'", (input, expected) => {
      expect(deserializeString(input)).toBe(expected)
    })

    it("returns undefined for null", () => {
      expect(deserializeString(null)).toBeUndefined()
    })

    it("uses last value from array", () => {
      expect(deserializeString(["first", "last"])).toBe("last")
    })

    it("returns empty string for empty array", () => {
      expect(deserializeString([])).toBe("")
    })
  })
})

describe("Number serializers", () => {
  describe("serializeNumber", () => {
    it.each([
      [42, "42"],
      [-42, "-42"],
      [0, "0"],
      [3.14, "3.14"],
      [3.0, "3"], // Note: 3.0 is treated as integer in JS
      [3.1, "3.1"],
      [null, ""],
    ])("serializes %s to '%s'", (input, expected) => {
      expect(serializeNumber(input)).toBe(expected)
    })

    it("handles very small decimals", () => {
      expect(serializeNumber(0.001)).toBe("0.001")
    })

    it("handles negative floats", () => {
      expect(serializeNumber(-3.14)).toBe("-3.14")
    })
  })

  describe("deserializeNumber", () => {
    it.each([
      ["42", 42],
      ["-42", -42],
      ["0", 0],
      ["3.14", 3.14],
      ["3.0", 3],
    ])("deserializes '%s' to %s", (input, expected) => {
      expect(deserializeNumber(input)).toBe(expected)
    })

    it("returns undefined for null", () => {
      expect(deserializeNumber(null)).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(deserializeNumber("")).toBeUndefined()
    })

    it("returns undefined for invalid number", () => {
      expect(deserializeNumber("not-a-number")).toBeUndefined()
    })

    it("uses last value from array", () => {
      expect(deserializeNumber(["1", "42"])).toBe(42)
    })

    it("parses as integer when asInt is true", () => {
      expect(deserializeNumber("3.7", true)).toBe(3)
      expect(deserializeNumber("42", true)).toBe(42)
    })
  })
})

describe("Color serializers", () => {
  describe("serializeColor", () => {
    it.each([
      ["#ff0000", "ff0000"],
      ["#FF0000", "ff0000"],
      ["ff0000", "ff0000"],
      ["#aabbcc", "aabbcc"],
      ["", ""],
      [null, ""],
    ])("serializes '%s' to '%s'", (input, expected) => {
      expect(serializeColor(input)).toBe(expected)
    })
  })

  describe("deserializeColor", () => {
    it.each([
      ["ff0000", "#ff0000"],
      ["FF0000", "#ff0000"],
      ["#ff0000", "#ff0000"],
      ["#FF0000", "#ff0000"],
      ["aabbcc", "#aabbcc"],
    ])("deserializes '%s' to '%s'", (input, expected) => {
      expect(deserializeColor(input)).toBe(expected)
    })

    it("returns undefined for null", () => {
      expect(deserializeColor(null)).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(deserializeColor("")).toBeUndefined()
    })

    it("uses last value from array", () => {
      expect(deserializeColor(["aabbcc", "ff0000"])).toBe("#ff0000")
    })
  })
})

describe("getLastValue", () => {
  it("returns string value directly", () => {
    expect(getLastValue("hello")).toBe("hello")
  })

  it("returns last value from array", () => {
    expect(getLastValue(["first", "last"])).toBe("last")
  })

  it("returns null for null input", () => {
    expect(getLastValue(null)).toBeNull()
  })

  it("returns null for empty array", () => {
    expect(getLastValue([])).toBeNull()
  })
})

describe("Query param key detection", () => {
  describe("QUERY_PARAM_KEY_PREFIX", () => {
    it("is the question mark character", () => {
      expect(QUERY_PARAM_KEY_PREFIX).toBe("?")
    })
  })

  describe("isQueryParamKey", () => {
    it.each([
      ["?enabled", true],
      ["?my_long_param_name", true],
      ["?x", true],
      ["?", true], // Edge case: just the prefix
      ["enabled", false],
      ["_enabled", false],
      ["#enabled", false],
      ["", false],
    ])("returns %s for '%s'", (input, expected) => {
      expect(isQueryParamKey(input)).toBe(expected)
    })

    it("returns false for null", () => {
      expect(isQueryParamKey(null)).toBe(false)
    })

    it("returns false for undefined", () => {
      expect(isQueryParamKey(undefined)).toBe(false)
    })
  })

  describe("extractQueryParamName", () => {
    it.each([
      ["?enabled", "enabled"],
      ["?my_long_param_name", "my_long_param_name"],
      ["?x", "x"],
      ["?", ""], // Edge case: just the prefix
      ["?query-with-dashes", "query-with-dashes"],
    ])("extracts '%s' from '%s'", (input, expected) => {
      expect(extractQueryParamName(input)).toBe(expected)
    })
  })
})

// --- Category B: Date, Time, and Range serializers ---

describe("Date serializers", () => {
  describe("serializeDate", () => {
    it("serializes a date to ISO format", () => {
      const date = new Date(2025, 0, 15) // January 15, 2025
      expect(serializeDate(date)).toBe("2025-01-15")
    })

    it("handles single-digit months and days with padding", () => {
      const date = new Date(2025, 4, 5) // May 5, 2025
      expect(serializeDate(date)).toBe("2025-05-05")
    })

    it("returns empty string for null", () => {
      expect(serializeDate(null)).toBe("")
    })

    it("returns empty string for invalid date", () => {
      expect(serializeDate(new Date("invalid"))).toBe("")
    })
  })

  describe("deserializeDate", () => {
    it("deserializes ISO format to date", () => {
      const result = deserializeDate("2025-01-15")
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2025)
      expect(result?.getMonth()).toBe(0) // January
      expect(result?.getDate()).toBe(15)
    })

    it("returns undefined for null", () => {
      expect(deserializeDate(null)).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(deserializeDate("")).toBeUndefined()
    })

    it("returns undefined for invalid format", () => {
      expect(deserializeDate("01-15-2025")).toBeUndefined()
      expect(deserializeDate("2025/01/15")).toBeUndefined()
      expect(deserializeDate("not-a-date")).toBeUndefined()
    })

    it("returns undefined for invalid date values", () => {
      expect(deserializeDate("2025-02-30")).toBeUndefined() // Feb 30 doesn't exist
      expect(deserializeDate("2025-13-01")).toBeUndefined() // Month 13 doesn't exist
    })

    it("uses last value from array", () => {
      const result = deserializeDate(["2025-01-01", "2025-12-31"])
      expect(result?.getMonth()).toBe(11) // December
      expect(result?.getDate()).toBe(31)
    })
  })
})

describe("Date range serializers", () => {
  describe("serializeDateRange", () => {
    it("serializes a date range to comma-separated ISO", () => {
      const range: [Date, Date] = [new Date(2025, 0, 1), new Date(2025, 0, 31)]
      expect(serializeDateRange(range)).toBe("2025-01-01,2025-01-31")
    })

    it("serializes a single date as just ISO", () => {
      const single: [Date] = [new Date(2025, 5, 15)]
      expect(serializeDateRange(single)).toBe("2025-06-15")
    })

    it("returns empty string for null", () => {
      expect(serializeDateRange(null)).toBe("")
    })

    it("returns empty string for empty array", () => {
      expect(serializeDateRange([] as unknown as [Date])).toBe("")
    })
  })

  describe("deserializeDateRange", () => {
    it("deserializes comma-separated dates to range", () => {
      const result = deserializeDateRange("2025-01-01,2025-01-31")
      expect(result).toHaveLength(2)
      expect(result?.[0].getMonth()).toBe(0) // January
      expect(result?.[0].getDate()).toBe(1)
      expect(result?.[1]?.getMonth()).toBe(0)
      expect(result?.[1]?.getDate()).toBe(31)
    })

    it("deserializes single date to single-element tuple", () => {
      const result = deserializeDateRange("2025-06-15")
      expect(result).toHaveLength(1)
      expect(result?.[0].getMonth()).toBe(5) // June
      expect(result?.[0].getDate()).toBe(15)
    })

    it("returns undefined for null", () => {
      expect(deserializeDateRange(null)).toBeUndefined()
    })

    it("returns undefined for invalid dates in range", () => {
      expect(deserializeDateRange("invalid,dates")).toBeUndefined()
      expect(deserializeDateRange("2025-01-01,invalid")).toBeUndefined()
    })

    it("uses last value from array", () => {
      const result = deserializeDateRange(["2025-01-01", "2025-06-15"])
      expect(result).toHaveLength(1) // Single date
    })
  })
})

describe("Time serializers", () => {
  describe("serializeTime", () => {
    it("serializes time object to HH:MM format", () => {
      expect(serializeTime({ hour: 14, minute: 30 })).toBe("14:30")
    })

    it("serializes time object with seconds to HH:MM:SS format", () => {
      expect(serializeTime({ hour: 14, minute: 30, second: 45 })).toBe(
        "14:30:45"
      )
    })

    it("omits seconds when zero", () => {
      expect(serializeTime({ hour: 14, minute: 30, second: 0 })).toBe("14:30")
    })

    it("pads single digits", () => {
      expect(serializeTime({ hour: 9, minute: 5 })).toBe("09:05")
    })

    it("serializes Date object", () => {
      const date = new Date(2025, 0, 1, 14, 30, 45)
      expect(serializeTime(date)).toBe("14:30:45")
    })

    it("returns empty string for null", () => {
      expect(serializeTime(null)).toBe("")
    })
  })

  describe("deserializeTime", () => {
    it("deserializes HH:MM format", () => {
      const result = deserializeTime("14:30")
      expect(result).toEqual({ hour: 14, minute: 30, second: 0 })
    })

    it("deserializes HH:MM:SS format", () => {
      const result = deserializeTime("14:30:45")
      expect(result).toEqual({ hour: 14, minute: 30, second: 45 })
    })

    it("returns undefined for null", () => {
      expect(deserializeTime(null)).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(deserializeTime("")).toBeUndefined()
    })

    it("returns undefined for invalid format", () => {
      expect(deserializeTime("14-30")).toBeUndefined()
      expect(deserializeTime("2:30pm")).toBeUndefined()
      expect(deserializeTime("not-a-time")).toBeUndefined()
    })

    it("returns undefined for out-of-range values", () => {
      expect(deserializeTime("25:00")).toBeUndefined() // Hour > 23
      expect(deserializeTime("14:60")).toBeUndefined() // Minute > 59
      expect(deserializeTime("14:30:60")).toBeUndefined() // Second > 59
    })

    it("uses last value from array", () => {
      const result = deserializeTime(["09:00", "14:30"])
      expect(result).toEqual({ hour: 14, minute: 30, second: 0 })
    })
  })
})

describe("Number range serializers", () => {
  describe("serializeNumberRange", () => {
    it("serializes a range to comma-separated values", () => {
      expect(serializeNumberRange([10, 50])).toBe("10,50")
    })

    it("serializes float range", () => {
      expect(serializeNumberRange([1.5, 3.5])).toBe("1.5,3.5")
    })

    it("serializes single number", () => {
      expect(serializeNumberRange(42)).toBe("42")
    })

    it("returns empty string for null", () => {
      expect(serializeNumberRange(null)).toBe("")
    })
  })

  describe("deserializeNumberRange", () => {
    it("deserializes comma-separated to range", () => {
      const result = deserializeNumberRange("10,50")
      expect(result).toEqual([10, 50])
    })

    it("deserializes single value", () => {
      const result = deserializeNumberRange("42")
      expect(result).toBe(42)
    })

    it("handles asInt option", () => {
      const result = deserializeNumberRange("10.5,20.5", true)
      expect(result).toEqual([10, 20])
    })

    it("returns undefined for null", () => {
      expect(deserializeNumberRange(null)).toBeUndefined()
    })

    it("returns undefined for invalid values", () => {
      expect(deserializeNumberRange("a,b")).toBeUndefined()
      expect(deserializeNumberRange("10,b")).toBeUndefined()
    })

    it("uses last value from array", () => {
      const result = deserializeNumberRange(["10,20", "30,40"])
      expect(result).toEqual([30, 40])
    })
  })
})
