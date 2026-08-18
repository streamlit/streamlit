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

import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  LabelVisibility as LabelVisibilityProto,
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

const triggerChangeEvent = async (
  element: HTMLElement,
  key: "ArrowLeft" | "ArrowRight"
): Promise<void> => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  act(() => {
    element.focus()
  })
  await user.keyboard(`{${key}}`)
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
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
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
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<Slider {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

    render(<Slider {...props} />)

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
        String(props.element.default)
      )
      // React Aria uses native HTML attributes on <input type="range"> instead of
      // explicit aria-valuemin/max attributes.
      expect(slider).toHaveAttribute("min", `${props.element.min}`)
      expect(slider).toHaveAttribute("max", `${props.element.max}`)
    })

    it("handles value changes", async () => {
      const props = getProps()

      render(<Slider {...props} />)
      vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

      const slider = screen.getByRole("slider")

      await triggerChangeEvent(slider, "ArrowRight")

      expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenCalledWith(
        props.element,
        [6],
        { fromUi: true },
        undefined
      )

      expect(slider).toHaveAttribute("value", "6")
    })

    it("resets its value when form is cleared", async () => {
      // Create a widget in a clearOnSubmit form
      const props = getProps({ formId: "form" })
      props.widgetMgr.setFormSubmitBehaviors("form", true)

      render(<Slider {...props} />)

      vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

      const slider = screen.getByRole("slider")

      await triggerChangeEvent(slider, "ArrowRight")

      expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenLastCalledWith(
        props.element,
        [6],
        { fromUi: true },
        undefined
      )

      expect(slider).toHaveAttribute("value", "6")

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

      expect(slider).toHaveAttribute("value", "5")
    })
  })

  describe("Tick bar visibility", () => {
    it("is hidden by default and becomes visible on hover", async () => {
      const props = getProps()
      render(<Slider {...props} />)

      const tickBar = screen.getByTestId("stSliderTickBar")
      expect(tickBar).toHaveStyle("opacity: var(--slider-focused, 0)")

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const sliderContainer = screen.getByTestId("stSlider")
      await user.hover(sliderContainer)
      // Use waitFor since the tickbar has an animation:
      await waitFor(() => expect(tickBar).toBeVisible())

      await user.unhover(sliderContainer)
      await waitFor(() =>
        expect(tickBar).toHaveStyle("opacity: var(--slider-focused, 0)")
      )
    })

    it("sets data-focus-visible on thumb when focused via keyboard", async () => {
      const props = getProps()
      render(<Slider {...props} />)

      // Tab-navigate to focus the slider thumb via keyboard.
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.tab()

      // React Aria sets [data-focus-visible] when focus arrives via keyboard.
      // This attribute activates the --slider-focused CSS variable on StyledSlider
      // (via :focus-within:has(:focus-visible)), which transitions the tick bar
      // from opacity:0 to opacity:1. The full visual transition is verified by E2E.
      const focusedElement = document.querySelector("[data-focus-visible]")
      expect(focusedElement).toBeInTheDocument()
    })

    // Note: the "becomes visible while dragging via keyboard" test is not applicable
    // with React Aria because RA fires onChange and onChangeEnd synchronously in the
    // same keydown handler, so isDragging is true→false in the same React batch.
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

    it("gives each thumb a differentiated aria-label", () => {
      const props = getProps({ default: [1, 9] })
      render(<Slider {...props} />)

      const sliders = screen.getAllByRole("slider")
      expect(sliders[0]).toHaveAttribute(
        "aria-label",
        `${props.element.label} — start`
      )
      expect(sliders[1]).toHaveAttribute(
        "aria-label",
        `${props.element.label} — end`
      )
    })

    it("has the correct value", () => {
      const props = getProps({ default: [1, 9] })
      render(<Slider {...props} />)

      const sliders = screen.getAllByRole("slider")
      // React Aria uses native HTML attributes on <input type="range">.
      // First slider - max is constrained to the current value of second slider
      expect(sliders[0]).toHaveAttribute(
        "aria-valuetext",
        `${props.element.default[0]}`
      )
      expect(sliders[0]).toHaveAttribute("min", `${props.element.min}`)
      expect(sliders[0]).toHaveAttribute("max", `${props.element.default[1]}`)

      // Second slider - min is constrained to the current value of first slider
      expect(sliders[1]).toHaveAttribute(
        "aria-valuetext",
        `${props.element.default[1]}`
      )
      expect(sliders[1]).toHaveAttribute("min", `${props.element.default[0]}`)
      expect(sliders[1]).toHaveAttribute("max", `${props.element.max}`)
    })

    describe("value should be within bounds", () => {
      it("start > end", async () => {
        const props = getProps({ default: [5, 5] })
        render(<Slider {...props} />)

        const firstSlider = screen.getAllByRole("slider")[0]
        await triggerChangeEvent(firstSlider, "ArrowRight")

        expect(screen.getAllByRole("slider")[0]).toHaveAttribute("value", "5")
      })

      it("start < min", async () => {
        const props = getProps({ default: [0, 10] })
        render(<Slider {...props} />)

        const firstSlider = screen.getAllByRole("slider")[0]
        await triggerChangeEvent(firstSlider, "ArrowLeft")

        expect(firstSlider).toHaveAttribute("value", "0")
      })

      it("start > max", async () => {
        const props = getProps({ default: [10] })
        render(<Slider {...props} />)

        const slider = screen.getByRole("slider")
        await triggerChangeEvent(slider, "ArrowRight")

        expect(slider).toHaveAttribute("value", "10")
      })

      it("end < min", async () => {
        const props = getProps({ default: [0] })
        render(<Slider {...props} />)

        const slider = screen.getByRole("slider")
        await triggerChangeEvent(slider, "ArrowLeft")

        expect(slider).toHaveAttribute("value", "0")
      })

      it("end > max", async () => {
        const props = getProps({ default: [0, 10] })
        render(<Slider {...props} />)

        const secondSlider = screen.getAllByRole("slider")[1]
        await triggerChangeEvent(secondSlider, "ArrowRight")

        expect(secondSlider).toHaveAttribute("value", "10")
      })
    })

    it("handles value changes", async () => {
      const props = getProps({ default: [1, 9] })

      render(<Slider {...props} />)
      vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

      const sliders = screen.getAllByRole("slider")

      await triggerChangeEvent(sliders[1], "ArrowRight")

      expect(props.widgetMgr.setDoubleArrayValue).toHaveBeenCalledWith(
        props.element,
        [1, 10],
        {
          fromUi: true,
        },
        undefined
      )
      expect(sliders[0]).toHaveAttribute("value", "1")
      expect(sliders[1]).toHaveAttribute("value", "10")
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

    it("updates aria-valuetext correctly", async () => {
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
      await triggerChangeEvent(slider, "ArrowRight")

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

    it("sets widget value on mount using setStringArrayValue", () => {
      const props = getProps({
        default: [1],
        min: 0,
        max: 6,
        format: "%s",
        type: SliderProto.Type.SELECT_SLIDER,
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
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      vi.spyOn(props.widgetMgr, "setDoubleArrayValue")

      render(<Slider {...props} />)

      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["orange"],
        { fromUi: false },
        undefined
      )
      // Negative assertion: setDoubleArrayValue should NOT be called for select_slider
      expect(props.widgetMgr.setDoubleArrayValue).not.toHaveBeenCalled()
    })

    it("handles value changes with setStringArrayValue", async () => {
      const props = getProps({
        default: [1],
        min: 0,
        max: 6,
        format: "%s",
        type: SliderProto.Type.SELECT_SLIDER,
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
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const slider = screen.getByRole("slider")
      await triggerChangeEvent(slider, "ArrowRight")

      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["yellow"],
        { fromUi: true },
        undefined
      )
    })

    it("handles range value changes with setStringArrayValue", async () => {
      const props = getProps({
        default: [1, 4],
        min: 0,
        max: 6,
        format: "%s",
        type: SliderProto.Type.SELECT_SLIDER,
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
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      const sliders = screen.getAllByRole("slider")
      await triggerChangeEvent(sliders[1], "ArrowRight")

      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        ["orange", "indigo"],
        { fromUi: true },
        undefined
      )
    })

    it("reads rawValue from proto when available", () => {
      const props = getProps({
        default: [0],
        min: 0,
        max: 6,
        format: "%s",
        type: SliderProto.Type.SELECT_SLIDER,
        options: [
          "red",
          "orange",
          "yellow",
          "green",
          "blue",
          "indigo",
          "violet",
        ],
        rawValue: ["yellow"],
        setValue: true, // Indicates backend is sending the current value
      })

      render(<Slider {...props} />)
      const slider = screen.getByRole("slider")
      // rawValue is "yellow" which is at index 2
      // React Aria uses native HTML `value` attribute on <input type="range">
      expect(slider).toHaveAttribute("value", "2")
      expect(slider).toHaveAttribute("aria-valuetext", "yellow")
      // Negative assertion: should NOT use the default index (0)
      expect(slider).not.toHaveAttribute("value", "0")
      expect(slider).not.toHaveAttribute("aria-valuetext", "red")
    })
  })
})

describe("Slider query param binding", () => {
  it("registers query param binding for numeric slider when queryParamKey is set", () => {
    const props = getProps({
      queryParamKey: "my_slider",
      type: SliderProto.Type.SLIDER,
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Slider {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_slider",
      "double_array_value",
      props.element.default,
      false,
      "repeated"
    )
  })

  it("registers query param binding for select_slider with urlDefault strings", () => {
    const props = getProps({
      queryParamKey: "my_select_slider",
      type: SliderProto.Type.SELECT_SLIDER,
      options: ["red", "green", "blue"],
      default: [0],
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Slider {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_select_slider",
      "string_array_value",
      ["red"],
      false,
      "repeated"
    )
  })

  it("registers query param binding for range select_slider with urlDefault strings", () => {
    const props = getProps({
      queryParamKey: "my_range_slider",
      type: SliderProto.Type.SELECT_SLIDER,
      options: ["small", "medium", "large"],
      default: [0, 2],
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Slider {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_range_slider",
      "string_array_value",
      ["small", "large"],
      false,
      "repeated"
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({
      queryParamKey: "my_slider",
    })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<Slider {...props} />)

    unregisterSpy.mockClear()

    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Slider {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })
})
