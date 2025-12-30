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
import { NumberInput as NumberInputProto } from "@streamlit/protobuf"

import {
  canDecrement,
  canIncrement,
  formatValue,
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

describe("preciseStepArithmetic function", () => {
  describe("addition", () => {
    it("adds 0.1 + 0.01 precisely", () => {
      // Without precision handling: 0.1 + 0.01 = 0.11000000000000001
      expect(preciseStepArithmetic(0.1, 0.01, "add")).toBe(0.11)
    })

    it("adds 0.1 + 0.02 precisely", () => {
      expect(preciseStepArithmetic(0.1, 0.02, "add")).toBe(0.12)
    })

    it("adds 0.7 + 0.1 precisely", () => {
      // Without precision handling: 0.7 + 0.1 = 0.7999999999999999
      expect(preciseStepArithmetic(0.7, 0.1, "add")).toBe(0.8)
    })

    it("handles integer steps correctly", () => {
      expect(preciseStepArithmetic(5, 1, "add")).toBe(6)
    })

    it.each([
      { value: 0.1, step: 0.01, expected: 0.11 },
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
    it("subtracts 0.3 - 0.1 precisely", () => {
      // Without precision handling: 0.3 - 0.1 = 0.19999999999999998
      expect(preciseStepArithmetic(0.3, 0.1, "subtract")).toBe(0.2)
    })

    it("subtracts 0.2 - 0.1 precisely", () => {
      expect(preciseStepArithmetic(0.2, 0.1, "subtract")).toBe(0.1)
    })

    it("subtracts 0.12 - 0.01 precisely", () => {
      expect(preciseStepArithmetic(0.12, 0.01, "subtract")).toBe(0.11)
    })

    it("handles integer steps correctly", () => {
      expect(preciseStepArithmetic(5, 1, "subtract")).toBe(4)
    })

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
})
