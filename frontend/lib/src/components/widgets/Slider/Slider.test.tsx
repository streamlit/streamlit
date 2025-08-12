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

import React from "react"

import { act, fireEvent, screen } from "@testing-library/react"

import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  Slider as SliderProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { withTimezones } from "~lib/util/withTimezones"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Slider, { Props } from "./Slider"

const getProps = (
  elementProps: Partial<SliderProto> = {},
  props: Partial<Props> = {}
): Props => ({
  element: SliderProto.create({
    id: "1",
    label: "Label",
    format: "%d",
    default: [5],
    min: 0,
    max: 10,
    step: 1,
    options: [],
    ...elementProps,
  }),
  width: 600,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...props,
})

const triggerChangeEvent = (
  element: Element,
  key: "ArrowLeft" | "ArrowRight"
): void => {
  fireEvent.focus(element)
  // TODO: Utilize user-event instead of fireEvent
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(element, { key })
  // TODO: Utilize user-event instead of fireEvent
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyUp(element, { key })
}

describe("Slider widget", () => {
  vi.useFakeTimers()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()

    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("shows a label", () => {
    const props = getProps()
    render(<Slider {...props} />)

    const widgetLabel = screen.queryByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<Slider {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<Slider {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

    render(<Slider {...props} />)

    // We need to do this as we are using a debounce when the widget value is set
    vi.runAllTimers()

    expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenCalledWith(
      props.element,
      [5],
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setDoubleArrayValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

    render(<Slider {...props} />)

    // We need to do this as we are using a debounce when the widget value is set
    vi.runAllTimers()

    expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenCalledWith(
      props.element,
      [5],
      { fromUi: false },
      "myFragmentId"
    )
  })

  describe("Single value", () => {
    it("renders without crashing", () => {
      const props = getProps()
      render(<Slider {...props} />)

      const slider = screen.getByTestId("stSlider")
      expect(slider).toBeInTheDocument()
      expect(slider).toHaveClass("stSlider")
    })

    it("displays a thumb value", () => {
      const props = getProps()
      render(<Slider {...props} />)

      expect(screen.getAllByTestId("stSliderThumbValue")).toHaveLength(1)
    })

    it("has the correct value", () => {
      const props = getProps()
      render(<Slider {...props} />)

      const slider = screen.getByRole("slider")
      expect(slider).toHaveAttribute(
        "aria-valuetext",
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `${props.element.default}`
      )
      expect(slider).toHaveAttribute("aria-valuemin", `${props.element.min}`)
      expect(slider).toHaveAttribute("aria-valuemax", `${props.element.max}`)
    })

    it("handles value changes", () => {
      const props = getProps()

      render(<Slider {...props} />)
      vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

      const slider = screen.getByRole("slider")

      act(() => {
        triggerChangeEvent(slider, "ArrowRight")

        // We need to do this as we are using a debounce when the widget value is set
        vi.runAllTimers()
      })

      expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenCalledWith(
        props.element,
        [6],
        { fromUi: true },
        undefined
      )

      expect(slider).toHaveAttribute("aria-valuenow", "6")
    })

    it("resets its value when form is cleared", () => {
      // Create a widget in a clearOnSubmit form
      const props = getProps({ formId: "form" })
      props.widgetMgr.setFormSubmitBehaviors("form", true)

      render(<Slider {...props} />)

      vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

      const slider = screen.getByRole("slider")

      triggerChangeEvent(slider, "ArrowRight")

      act(() => {
        vi.runAllTimers()
      })

      expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenLastCalledWith(
        props.element,
        [6],
        { fromUi: true },
        undefined
      )

      expect(slider).toHaveAttribute("aria-valuenow", "6")

      act(() => {
        // "Submit" the form
        props.widgetMgr.submitForm("form", undefined)
      })

      // Our widget should be reset, and the widgetMgr should be updated
      expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenLastCalledWith(
        props.element,
        props.element.default,
        {
          fromUi: true,
        },
        undefined
      )

      expect(slider).toHaveAttribute("aria-valuenow", "5")
    })
  })

  describe("Range value", () => {
    it("renders without crashing", () => {
      const props = getProps({ default: [1, 9] })
      render(<Slider {...props} />)

      const sliders = screen.getAllByRole("slider")
      expect(sliders).toHaveLength(2)
    })

    it("displays 2 thumb values", () => {
      const props = getProps({ default: [1, 9] })
      render(<Slider {...props} />)

      expect(screen.getAllByTestId("stSliderThumbValue")).toHaveLength(2)
    })

    it("has the correct value", () => {
      const props = getProps({ default: [1, 9] })
      render(<Slider {...props} />)

      const sliders = screen.getAllByRole("slider")
      // First slider - max is the current value of second slider
      expect(sliders[0]).toHaveAttribute(
        "aria-valuetext",
        `${props.element.default[0]}`
      )
      expect(sliders[0]).toHaveAttribute(
        "aria-valuemin",
        `${props.element.min}`
      )
      expect(sliders[0]).toHaveAttribute(
        "aria-valuemax",
        `${props.element.default[1]}`
      )

      // Second slider - min is the current value of first slider
      expect(sliders[1]).toHaveAttribute(
        "aria-valuetext",
        `${props.element.default[1]}`
      )
      expect(sliders[1]).toHaveAttribute(
        "aria-valuemin",
        `${props.element.default[0]}`
      )
      expect(sliders[1]).toHaveAttribute(
        "aria-valuemax",
        `${props.element.max}`
      )
    })

    describe("value should be within bounds", () => {
      it("start > end", () => {
        const props = getProps({ default: [5, 5] })
        render(<Slider {...props} />)

        const firstSlider = screen.getAllByRole("slider")[0]
        triggerChangeEvent(firstSlider, "ArrowRight")

        expect(screen.getAllByRole("slider")[0]).toHaveAttribute(
          "aria-valuenow",
          "5"
        )
      })

      it("start < min", () => {
        const props = getProps({ default: [0, 10] })
        render(<Slider {...props} />)

        const firstSlider = screen.getAllByRole("slider")[0]
        triggerChangeEvent(firstSlider, "ArrowLeft")

        expect(firstSlider).toHaveAttribute("aria-valuenow", "0")
      })

      it("start > max", () => {
        const props = getProps({ default: [10] })
        render(<Slider {...props} />)

        const slider = screen.getByRole("slider")
        triggerChangeEvent(slider, "ArrowRight")

        expect(slider).toHaveAttribute("aria-valuenow", "10")
      })

      it("end < min", () => {
        const props = getProps({ default: [0] })
        render(<Slider {...props} />)

        const slider = screen.getByRole("slider")
        triggerChangeEvent(slider, "ArrowLeft")

        expect(slider).toHaveAttribute("aria-valuenow", "0")
      })

      it("end > max", () => {
        const props = getProps({ default: [0, 10] })
        render(<Slider {...props} />)

        const secondSlider = screen.getAllByRole("slider")[1]
        triggerChangeEvent(secondSlider, "ArrowRight")

        expect(secondSlider).toHaveAttribute("aria-valuenow", "10")
      })
    })

    it("handles value changes", () => {
      const props = getProps({ default: [1, 9] })

      render(<Slider {...props} />)
      vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

      const sliders = screen.getAllByRole("slider")

      triggerChangeEvent(sliders[1], "ArrowRight")

      act(() => {
        // We need to do this as we are using a debounce when the widget value is set
        vi.runAllTimers()
      })

      expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenCalledWith(
        props.element,
        [1, 10],
        {
          fromUi: true,
        },
        undefined
      )
      expect(sliders[0]).toHaveAttribute("aria-valuenow", "1")
      expect(sliders[1]).toHaveAttribute("aria-valuenow", "10")
    })
  })

  describe("Datetime slider", () => {
    withTimezones(() => {
      it("formats datetime values correctly", () => {
        const DAYS_IN_MICROS = 24 * 60 * 60 * 1000 * 1000
        const WEEK_IN_MICROS = 7 * DAYS_IN_MICROS

        const props = getProps({
          // The default value should be divisible by step.
          // Otherwise, we get a warning from `react-range`.
          default: [0],
          min: 0,
          max: 4 * WEEK_IN_MICROS,
          step: DAYS_IN_MICROS,
          format: "YYYY-MM-DD",
          dataType: SliderProto.DataType.DATETIME,
        })
        render(<Slider {...props} />)

        // Test that the thumb value shows formatted datetime
        const thumbValue = screen.getByTestId("stSliderThumbValue")
        expect(thumbValue).toHaveTextContent("1970-01-01")
      })
    })
  })

  describe("Options prop", () => {
    it("renders without crashing", () => {
      const props = getProps({
        default: [1],
        min: 0,
        max: 6,
        format: "%s",
        options: [
          "red",
          "orange",
          "yellow",
          "green",
          "blue",
          "indigo",
          "violet",
        ],
      })
      render(<Slider {...props} />)

      expect(screen.getByRole("slider")).toBeDefined()
    })

    it("sets aria-valuetext correctly", () => {
      const props = getProps({
        default: [1],
        min: 0,
        max: 6,
        format: "%s",
        options: [
          "red",
          "orange",
          "yellow",
          "green",
          "blue",
          "indigo",
          "violet",
        ],
      })
      render(<Slider {...props} />)
      const slider = screen.getByRole("slider")
      expect(slider).toHaveAttribute("aria-valuetext", "orange")
    })

    it("updates aria-valuetext correctly", () => {
      const originalProps = {
        default: [1],
        min: 0,
        max: 6,
        format: "%s",
        options: [
          "red",
          "orange",
          "yellow",
          "green",
          "blue",
          "indigo",
          "violet",
        ],
      }
      const props = getProps(originalProps)
      render(<Slider {...props} />)

      const slider = screen.getByRole("slider")
      triggerChangeEvent(slider, "ArrowRight")

      act(() => {
        // We need to do this as we are using a debounce when the widget value is set
        vi.runAllTimers()
      })

      expect(slider).toHaveAttribute("aria-valuetext", "yellow")
    })

    it("sets aria-valuetext correctly for a range", () => {
      const props = getProps({
        default: [1, 4],
        min: 0,
        max: 6,
        format: "%s",
        options: [
          "red",
          "orange",
          "yellow",
          "green",
          "blue",
          "indigo",
          "violet",
        ],
      })
      render(<Slider {...props} />)
      const sliders = screen.getAllByRole("slider")
      expect(sliders[0]).toHaveAttribute("aria-valuetext", "orange")
      expect(sliders[1]).toHaveAttribute("aria-valuetext", "blue")
    })
  })
})
