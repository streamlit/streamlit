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

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { formatNumber, isNumericString } from "./formatNumber"

describe("formatNumber", () => {
  // Save and restore locale for each test to ensure test isolation
  let originalLanguages: readonly string[]

  beforeEach(() => {
    originalLanguages = navigator.languages
    // Set to en-US locale for consistent test results
    Object.defineProperty(navigator, "languages", {
      value: ["en-US"],
      configurable: true,
    })
  })

  afterEach(() => {
    // Restore original navigator languages
    Object.defineProperty(navigator, "languages", {
      value: originalLanguages,
      configurable: true,
    })
  })

  it("returns empty string for NaN", () => {
    expect(formatNumber(NaN)).toBe("")
  })

  it("returns empty string for Infinity", () => {
    expect(formatNumber(Infinity)).toBe("")
    expect(formatNumber(-Infinity)).toBe("")
  })

  it("enforces localized currency format as narrow", () => {
    // Change locale for this test:
    Object.defineProperty(navigator, "languages", {
      value: ["pt-BR"],
      configurable: true,
    })

    // Use regex to handle different types of spaces (regular space, non-breaking space, narrow no-break space)
    // pt-BR locale uses comma as decimal separator and narrow symbol for currency
    expect(formatNumber(10.123, "euro")).toMatch(/^€\s*10,12$/)
    expect(formatNumber(10.123, "dollar")).toMatch(/^\$\s*10,12$/)
    expect(formatNumber(10.123, "yen")).toMatch(/^¥\s*10$/) // would be JP¥ 10 if narrow symbol is not used
  })

  it.each([
    [10, "10"],
    [10.1, "10.1"],
    [10.123, "10.123"],
    [10.1234, "10.1234"],
    // Rounds to 4 decimals
    [10.12346, "10.1235"],
    [0.00016, "0.0002"],
    // If number is smaller than 0.0001, shows the next decimal number
    // to avoid showing 0 for small numbers.
    [0.000051, "0.00005"],
    [0.00000123, "0.000001"],
    [0.00000183, "0.000002"],
    [0.0000000061, "0.000000006"],
  ])(
    "formats %s to %s with default options (no trailing zeros)",
    (value, expected) => {
      expect(formatNumber(value)).toEqual(expected)
    }
  )

  it.each([
    [10, 0, "10"],
    [10, 4, "10.0000"],
    [10.123, 0, "10"],
    [10.123, 1, "10.1"],
    [10.123, 2, "10.12"],
    [10.123, 3, "10.123"],
    [10.123, 4, "10.1230"],
    [10.123, 5, "10.12300"],
    [0.123, 0, "0"],
    [0.123, 1, "0.1"],
  ])(
    "formats %s to %s with %s decimals (keeps trailing zeros)",
    (value, decimals, expected) => {
      expect(formatNumber(value, undefined, decimals)).toEqual(expected)
    }
  )

  it.each([
    [0.5, "percent", "50%"],
    [0.51236, "percent", "51.24%"],
    [-1.123456, "percent", "-112.35%"],
    [0, "percent", "0%"],
    [0.00001, "percent", "0%"],
    [1000, "compact", "1K"],
    [1100, "compact", "1.1K"],
    [10, "compact", "10"],
    [10.123, "compact", "10"],
    [123456789, "compact", "123M"],
    [1000, "scientific", "1E3"],
    [123456789, "scientific", "1.235E8"],
    [1000, "engineering", "1E3"],
    [123456789, "engineering", "123.457E6"],
    [1234.567, "engineering", "1.235E3"],
    // plain
    [10.1231234, "plain", "10.1231234"],
    [-1234.456789, "plain", "-1234.456789"],
    [0.00000001, "plain", "0.00000001"],
    // dollar
    [10, "dollar", "$10.00"],
    [10.123, "dollar", "$10.12"],
    [-1234.456789, "dollar", "-$1,234.46"],
    [0.00000001, "dollar", "$0.00"],
    // euro
    [10, "euro", "€10.00"],
    [10.123, "euro", "€10.12"],
    [-1234.456789, "euro", "-€1,234.46"],
    [0.00000001, "euro", "€0.00"],
    // yen
    [10.123, "yen", "¥10"],
    [-1234.456789, "yen", "-¥1,234"],
    [0.00000001, "yen", "¥0"],
    // localized
    [10.123, "localized", "10.123"],
    [-1234.456789, "localized", "-1,234.457"],
    [0.001, "localized", "0.001"],
    // accounting
    [10.123, "accounting", "10.12"],
    [-10.126, "accounting", "(10.13)"],
    [-10.1, "accounting", "(10.10)"],
    [1000000.123412, "accounting", "1,000,000.12"],
    [-1000000.123412, "accounting", "(1,000,000.12)"],
    // bytes
    [0, "bytes", "0B"],
    [12, "bytes", "12B"],
    [123, "bytes", "123B"],
    [12345, "bytes", "12.3KB"],
    [123456789, "bytes", "123.5MB"],
    [1234567890, "bytes", "1.2GB"],
    [1234567890000, "bytes", "1.2TB"],
    [1234567890000000, "bytes", "1234.6TB"],
    // sprintf format
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
    [0.123456, "%.4f", "0.1235"],
    [0.123456, "%.4g", "0.1235"],
    // Test boolean formatting:
    [1, "%t", "true"],
    [0, "%t", "false"],
    // Test zero-padding for integers
    [42, "%05d", "00042"],
    // Test scientific notations:
    [1234.5678, "%.2e", "1.23e+3"],
    [0.000123456, "%.2e", "1.23e-4"],
    // Test hexadecimal representation:
    [255, "%x", "ff"],
    [255, "%X", "FF"],
    [4096, "%X", "1000"],
    // Test octal representation:
    [8, "%o", "10"],
    [64, "%o", "100"],
    // Test fixed width formatting:
    [12345, "%8d", "   12345"],
    [12.34, "%8.2f", "   12.34"],
    [12345, "%'_8d", "___12345"],
    // Test left-justified formatting:
    [12345, "%-8d", "12345   "],
    [12.34, "%-8.2f", "12.34   "],
    // Test prefixing with plus sign:
    [42, "%+d", "+42"],
    [-42, "%+d", "-42"],
  ])("formats %s with format %s to '%s'", (value, format, expected) => {
    expect(formatNumber(value, format)).toEqual(expected)
  })

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
    "cannot format %s using the invalid sprintf format %s",
    (input: number, format: string) => {
      expect(() => {
        formatNumber(input, format)
      }).toThrow()
    }
  )

  it.each([
    // No format (default)
    [10.123, undefined, 2, "10.12"],
    [10.123, undefined, 5, "10.12300"],
    // localized
    [10.12345, "localized", undefined, "10.123"],
    [10.12345, "localized", 2, "10.12"],
    [10, "localized", 3, "10.000"],
    // percent - the max precision is applied to the raw value:
    [0.12345, "percent", undefined, "12.35%"],
    [0.12345, "percent", 3, "12.3%"],
    [0.12345, "percent", 4, "12.35%"],
    [0.123, "percent", 5, "12.300%"],
    [0.123, "percent", 0, "12%"],
    // dollar
    [10.129, "dollar", undefined, "$10.13"],
    [10.129, "dollar", 2, "$10.13"],
    [10.129, "dollar", 0, "$10"],
    [10, "dollar", 3, "$10.000"],
    // euro
    [10.129, "euro", undefined, "€10.13"],
    [10.129, "euro", 2, "€10.13"],
    [10.129, "euro", 0, "€10"],
    [10, "euro", 3, "€10.000"],
    // yen
    [10.129, "yen", undefined, "¥10"],
    [10.129, "yen", 0, "¥10"],
    [10.129, "yen", 2, "¥10.13"],
    // bytes - doesn't impact bytes:
    [10.129, "bytes", undefined, "10.1B"],
    [10.129, "bytes", 2, "10.1B"],
    [10.129, "bytes", 0, "10.1B"],
    // accounting
    [-10.129, "accounting", undefined, "(10.13)"],
    [-10.129, "accounting", 2, "(10.13)"],
    [-10.129, "accounting", 1, "(10.1)"],
    [1000, "accounting", 0, "1,000"],
    [-10, "accounting", 3, "(10.000)"],
  ])(
    "formats %s with format %s and maxPrecision %d to '%s'",
    (value, format, maxPrecision, expected) => {
      expect(formatNumber(value, format, maxPrecision)).toEqual(expected)
    }
  )
})

describe("isNumericString", () => {
  it("returns true for valid numeric strings", () => {
    expect(isNumericString("123")).toBe(true)
    expect(isNumericString("123.45")).toBe(true)
    expect(isNumericString("-123")).toBe(true)
    expect(isNumericString("-123.45")).toBe(true)
    expect(isNumericString("0")).toBe(true)
    expect(isNumericString("0.0")).toBe(true)
    expect(isNumericString("1e10")).toBe(true)
    expect(isNumericString("1.23e-4")).toBe(true)
    expect(isNumericString("  123  ")).toBe(true)
  })

  it("returns false for non-numeric strings", () => {
    expect(isNumericString("")).toBe(false)
    expect(isNumericString("   ")).toBe(false)
    expect(isNumericString("abc")).toBe(false)
    expect(isNumericString("123abc")).toBe(false)
    expect(isNumericString("abc123")).toBe(false)
    expect(isNumericString("70 °F")).toBe(false)
    expect(isNumericString("$100")).toBe(false)
    expect(isNumericString("100%")).toBe(false)
    expect(isNumericString("1,234")).toBe(false) // Comma is not valid
    expect(isNumericString("—")).toBe(false) // Em dash used for None values
  })

  it("returns false for Infinity and NaN strings", () => {
    expect(isNumericString("Infinity")).toBe(false)
    expect(isNumericString("-Infinity")).toBe(false)
    expect(isNumericString("NaN")).toBe(false)
  })
})
