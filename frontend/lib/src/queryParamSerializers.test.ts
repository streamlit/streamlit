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
  deserializeNumber,
  deserializeString,
  extractQueryParamName,
  getLastValue,
  isQueryParamKey,
  QUERY_PARAM_KEY_PREFIX,
  serializeBool,
  serializeColor,
  serializeNumber,
  serializeString,
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
