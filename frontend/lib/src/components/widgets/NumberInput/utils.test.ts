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
import { NumberInput as NumberInputProto } from "@streamlit/protobuf"

import {
  canDecrement,
  canIncrement,
  formatValue,
  getDecimalPlaces,
  getStep,
  preciseStepArithmetic,
} from "./utils"

describe("canDecrement function", () => {
  it("returns true if decrementing stays above min", () => {
    expect(canDecrement(5, 1, 0)).toBe(true)
  })

  it("returns true if decrementing equals min", () => {
    expect(canDecrement(1, 1, 0)).toBe(true)
  })

  it("returns false if decrementing goes below min", () => {
    expect(canDecrement(0, 1, 0)).toBe(false)
  })
})

describe("canIncrement function", () => {
  it("returns true if incrementing stays below max", () => {
    expect(canIncrement(5, 1, 10)).toBe(true)
  })

  it("returns true if incrementing equals max", () => {
    expect(canIncrement(5, 5, 10)).toBe(true)
  })

  it("returns false if incrementing goes above max", () => {
    expect(canIncrement(10, 1, 10)).toBe(false)
  })
})

describe("formatValue function", () => {
  it("returns null for null value", () => {
    expect(
      formatValue({
        value: null,
        format: null,
        step: 1,
        dataType: NumberInputProto.DataType.INT,
      })
    ).toBeNull()
  })

  it("returns formatted value when step is undefined", () => {
    expect(
      formatValue({
        value: 123,
        format: null,
        dataType: NumberInputProto.DataType.INT,
      })
    ).toBe("123")
  })

  it("formats integer without specified format", () => {
    expect(
      formatValue({
        value: 123,
        format: null,
        step: 1,
        dataType: NumberInputProto.DataType.INT,
      })
    ).toBe("123")
  })

  it("formats float without specified format, considering step for precision", () => {
    expect(
      formatValue({
        value: 123.456,
        format: null,
        step: 0.01,
        dataType: NumberInputProto.DataType.FLOAT,
      })
    ).toBe("123.46")
  })

  it("respects format string for integers", () => {
    expect(
      formatValue({
        value: 123,
        format: "%04d",
        step: 1,
        dataType: NumberInputProto.DataType.INT,
      })
    ).toBe("0123")
  })

  it("respects format string for integers when step not included", () => {
    expect(
      formatValue({
        value: 123,
        format: "%04d",
        dataType: NumberInputProto.DataType.INT,
      })
    ).toBe("0123")
  })

  it("respects format string for floats", () => {
    expect(
      formatValue({
        value: 123.456,
        format: "%.2f",
        step: 0.01,
        dataType: NumberInputProto.DataType.FLOAT,
      })
    ).toBe("123.46")
  })

  describe("scientific notation steps", () => {
    it("formats float with scientific notation step (1e-7)", () => {
      expect(
        formatValue({
          value: 0.0000005,
          format: null,
          step: 0.0000001, // 1e-7
          dataType: NumberInputProto.DataType.FLOAT,
        })
      ).toBe("0.0000005")
    })

    it("formats float with scientific notation step with decimal coefficient (2.5e-8)", () => {
      expect(
        formatValue({
          value: 0.000000025,
          format: null,
          step: 2.5e-8,
          dataType: NumberInputProto.DataType.FLOAT,
        })
      ).toBe("0.000000025")
    })
  })
})

describe("getStep function", () => {
  it("returns step when provided", () => {
    const element = NumberInputProto.create({
      label: "Label",
      step: 3,
      dataType: NumberInputProto.DataType.INT,
    })
    expect(getStep(element)).toBe(3)
  })

  it("returns default INT value", () => {
    const element = NumberInputProto.create({
      label: "Label",
      dataType: NumberInputProto.DataType.INT,
    })
    expect(getStep(element)).toBe(1)
  })

  it("returns default float value", () => {
    const element = NumberInputProto.create({
      label: "Label",
      dataType: NumberInputProto.DataType.FLOAT,
    })
    expect(getStep(element)).toBe(0.01)
  })
})

describe("getDecimalPlaces function", () => {
  describe("standard decimal notation", () => {
    it.each([
      { step: 1, expected: 0 },
      { step: 0.1, expected: 1 },
      { step: 0.01, expected: 2 },
      { step: 0.001, expected: 3 },
      { step: 0.0001, expected: 4 },
      { step: 0.00001, expected: 5 },
      { step: 0.000001, expected: 6 },
    ])("returns $expected for step=$step", ({ step, expected }) => {
      expect(getDecimalPlaces(step)).toBe(expected)
    })
  })

  describe("scientific notation", () => {
    // JavaScript represents very small numbers in scientific notation
    // e.g., 0.0000001 becomes "1e-7"
    it.each([
      { step: 0.0000001, expected: 7 }, // 1e-7
      { step: 0.00000001, expected: 8 }, // 1e-8
      { step: 0.000000001, expected: 9 }, // 1e-9
      { step: 0.0000000001, expected: 10 }, // 1e-10
      { step: 5e-7, expected: 7 }, // coefficient 5 has no decimals
    ])(
      "returns $expected for step=$step (scientific notation)",
      ({ step, expected }) => {
        expect(getDecimalPlaces(step)).toBe(expected)
      }
    )
  })

  describe("scientific notation with decimal coefficients", () => {
    // For coefficients with decimals (e.g., 2.5e-8), we need to add
    // the coefficient's decimal places to the exponent
    // 2.5e-8 = 0.000000025 = 9 decimal places (1 from 2.5 + 8 from exponent)
    it.each([
      { step: 2.5e-8, expected: 9 }, // 0.000000025
      { step: 1.25e-6, expected: 8 }, // 0.00000125 (2 decimals + 6 exponent)
      { step: 3.14e-5, expected: 7 }, // 0.0000314 (2 decimals + 5 exponent)
      { step: 1.5e-10, expected: 11 }, // (1 decimal + 10 exponent)
    ])(
      "returns $expected for step=$step (coefficient with decimals)",
      ({ step, expected }) => {
        expect(getDecimalPlaces(step)).toBe(expected)
      }
    )
  })
})

describe("preciseStepArithmetic function", () => {
  describe("addition", () => {
    it("handles integer steps correctly", () => {
      expect(preciseStepArithmetic(5, 1, "add")).toBe(6)
    })

    // Parameterized tests cover floating point precision cases
    // e.g., 0.1 + 0.01 = 0.11 (not 0.11000000000000001)
    // e.g., 0.7 + 0.1 = 0.8 (not 0.7999999999999999)
    it.each([
      { value: 0.1, step: 0.01, expected: 0.11 },
      { value: 0.1, step: 0.02, expected: 0.12 },
      { value: 0.11, step: 0.01, expected: 0.12 },
      { value: 0.12, step: 0.01, expected: 0.13 },
      { value: 0.7, step: 0.1, expected: 0.8 },
      { value: 0.8, step: 0.1, expected: 0.9 },
      { value: 0.9, step: 0.1, expected: 1.0 },
    ])("adds $value + $step = $expected", ({ value, step, expected }) => {
      expect(preciseStepArithmetic(value, step, "add")).toBe(expected)
    })
  })

  describe("subtraction", () => {
    it("handles integer steps correctly", () => {
      expect(preciseStepArithmetic(5, 1, "subtract")).toBe(4)
    })

    // Parameterized tests cover floating point precision cases
    // e.g., 0.3 - 0.1 = 0.2 (not 0.19999999999999998)
    it.each([
      { value: 0.3, step: 0.1, expected: 0.2 },
      { value: 0.2, step: 0.1, expected: 0.1 },
      { value: 0.1, step: 0.1, expected: 0.0 },
      { value: 0.12, step: 0.01, expected: 0.11 },
      { value: 0.11, step: 0.01, expected: 0.1 },
    ])("subtracts $value - $step = $expected", ({ value, step, expected }) => {
      expect(preciseStepArithmetic(value, step, "subtract")).toBe(expected)
    })
  })

  describe("scientific notation steps", () => {
    // Very small steps are represented in scientific notation by JavaScript
    // e.g., 0.0000001.toString() === "1e-7"
    it("handles addition with scientific notation step", () => {
      const step = 0.0000001 // 1e-7
      expect(preciseStepArithmetic(0.1, step, "add")).toBe(0.1000001)
    })

    it("handles subtraction with scientific notation step", () => {
      const step = 0.0000001 // 1e-7
      expect(preciseStepArithmetic(0.1000001, step, "subtract")).toBe(0.1)
    })

    it("handles multiple increments with scientific notation step", () => {
      const step = 0.0000001 // 1e-7
      let value = 0
      for (let i = 0; i < 10; i++) {
        value = preciseStepArithmetic(value, step, "add")
      }
      // Should be exactly 0.000001, not 0.0000009999999999...
      expect(value).toBe(0.000001)
    })
  })
})
