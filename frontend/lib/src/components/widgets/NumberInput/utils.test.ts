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

import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  canDecrement,
  canIncrement,
  formatValue,
  getInitialValue,
  getStep,
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

describe("getInitialValue function", () => {
  it("returns widget value when dataType is INT and the widget has a value", () => {
    const props = {
      element: NumberInputProto.create({
        label: "Label",
        dataType: NumberInputProto.DataType.INT,
      }),
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: vi.fn(),
        formsDataChanged: vi.fn(),
      }),
    }
    vi.spyOn(props.widgetMgr, "getIntValue").mockReturnValue(3)
    expect(getInitialValue(props)).toBe(3)
  })

  it("returns widget value when the dataType is FLOAT and the widget has a value", () => {
    const props = {
      element: NumberInputProto.create({
        label: "Label",
        dataType: NumberInputProto.DataType.FLOAT,
      }),
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: vi.fn(),
        formsDataChanged: vi.fn(),
      }),
    }
    vi.spyOn(props.widgetMgr, "getDoubleValue").mockReturnValue(0.03)
    expect(getInitialValue(props)).toBe(0.03)
  })

  it("returns default value when widget has no value", () => {
    const props = {
      element: NumberInputProto.create({
        label: "Label",
        dataType: NumberInputProto.DataType.FLOAT,
        default: 0.01,
      }),
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: vi.fn(),
        formsDataChanged: vi.fn(),
      }),
    }
    expect(getInitialValue(props)).toBe(0.01)
  })

  it("returns null when widget has no value and no default is provided", () => {
    const props = {
      element: NumberInputProto.create({
        label: "Label",
        dataType: NumberInputProto.DataType.FLOAT,
      }),
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: vi.fn(),
        formsDataChanged: vi.fn(),
      }),
    }
    expect(getInitialValue(props)).toBe(null)
  })
})
