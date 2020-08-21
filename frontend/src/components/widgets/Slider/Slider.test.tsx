/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { mount, shallow } from "enzyme"
import { fromJS } from "immutable"
import { sliderOverrides } from "lib/widgetTheme"
import { Slider as SliderProto } from "autogen/proto"
import { Slider as UISlider } from "baseui/slider"
import TimezoneMock from "timezone-mock"
import { WidgetStateManager } from "lib/WidgetStateManager"

import Slider, { Props } from "./Slider"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()
const getProps = (elementProps: Record<string, unknown> = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    format: "%d",
    default: [5],
    min: 0,
    max: 10,
    step: 1,
    options: [],
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("Slider widget", () => {
  jest.useFakeTimers()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it("should show a label", () => {
    const props = getProps()
    const wrapper = shallow(<Slider {...props} />)

    expect(wrapper.find("label").text()).toBe("Label")
  })

  it("should send the value to the backend when did mount", async () => {
    const props = getProps()

    const wrapper = shallow(<Slider {...props} />)

    // We need to do this as we are using a debounce when the widget value is set
    jest.runAllTimers()

    expect(props.widgetMgr.setFloatArrayValue).toHaveBeenCalledWith(
      props.element.get("id"),
      [5],
      { fromUi: false }
    )

    wrapper.unmount()
  })

  describe("Overrides", () => {
    const props = getProps()
    const wrapper = shallow(<Slider {...props} />)

    it("should render thumb value", () => {
      // @ts-ignore
      const thumbValue = wrapper
        .find(UISlider)
        .prop("overrides")
        // @ts-ignore
        .ThumbValue({
          $thumbIndex: 0,
          $value: [1],
        })

      const thumbValueWrapper = shallow(thumbValue)

      expect(thumbValueWrapper.text()).toBe("1")
    })

    it("should render tick bar with min and max", () => {
      // @ts-ignore
      const thumbValue = wrapper
        .find(UISlider)
        .prop("overrides")
        // @ts-ignore
        .TickBar()

      const thumbValueWrapper = shallow(thumbValue)

      expect(thumbValueWrapper.find(".tickBarMin").text()).toBe("0")
      expect(thumbValueWrapper.find(".tickBarMax").text()).toBe("10")
    })

    it("should contain sliderOverrides", () => {
      Object.keys(sliderOverrides).forEach(property => {
        expect(wrapper.find(UISlider).prop("overrides")).toHaveProperty(
          property
        )
      })
    })
  })

  describe("Single value", () => {
    it("renders without crashing", () => {
      const props = getProps()
      const wrapper = shallow(<Slider {...props} />)

      expect(wrapper).toBeDefined()
    })

    it("should have a correct value", () => {
      const props = getProps()
      const wrapper = shallow(<Slider {...props} />)
      const UISliderWrapper = wrapper.find(UISlider)
      const propValue = UISliderWrapper.prop("value")

      expect(propValue).toStrictEqual(props.element.get("default").toJS())
      expect(propValue[0]).toBeGreaterThanOrEqual(props.element.get("min"))
      expect(propValue[0]).toBeLessThan(props.element.get("max"))
    })

    it("should handle value changes", async () => {
      const props = getProps()
      const wrapper = shallow(<Slider {...props} />)

      // @ts-ignore
      wrapper.find(UISlider).prop("onChange")({
        value: [10],
      })

      // We need to do this as we are using a debounce when the widget value is set
      jest.runAllTimers()

      expect(props.widgetMgr.setFloatArrayValue).toHaveBeenCalledWith(
        props.element.get("id"),
        [10],
        { fromUi: true }
      )
      expect(wrapper.find(UISlider).prop("value")).toStrictEqual([10])
    })
  })

  describe("Range value", () => {
    it("renders without crashing", () => {
      const props = getProps({
        default: [1, 9],
      })
      const wrapper = shallow(<Slider {...props} />)

      expect(wrapper).toBeDefined()
    })

    it("should have a correct value", () => {
      const props = getProps({
        default: [1, 9],
      })
      const wrapper = shallow(<Slider {...props} />)
      const UISliderWrapper = wrapper.find(UISlider)
      const propValue = UISliderWrapper.prop("value")

      expect(propValue).toStrictEqual(props.element.get("default").toJS())

      propValue.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(props.element.get("min"))
        expect(value).toBeLessThan(props.element.get("max"))
      })
    })

    describe("value should be within bounds", () => {
      const props = getProps({
        default: [1, 9],
      })
      const wrapper = shallow(<Slider {...props} />)

      it("start > end", () => {
        // @ts-ignore
        wrapper.find(UISlider).prop("onChange")({
          value: [11, 10],
        })

        expect(wrapper.find(UISlider).prop("value")).toStrictEqual([10, 10])
      })

      it("start < min", () => {
        // @ts-ignore
        wrapper.find(UISlider).prop("onChange")({
          value: [-1, 10],
        })

        expect(wrapper.find(UISlider).prop("value")).toStrictEqual([0, 10])
      })

      it("start > max", () => {
        // @ts-ignore
        wrapper.find(UISlider).prop("onChange")({
          value: [11],
        })

        expect(wrapper.find(UISlider).prop("value")).toStrictEqual([10])
      })

      it("end < min", () => {
        // @ts-ignore
        wrapper.find(UISlider).prop("onChange")({
          value: [1, -1],
        })

        expect(wrapper.find(UISlider).prop("value")).toStrictEqual([0, 0])
      })

      it("end > max", () => {
        // @ts-ignore
        wrapper.find(UISlider).prop("onChange")({
          value: [1, 11],
        })

        expect(wrapper.find(UISlider).prop("value")).toStrictEqual([1, 10])
      })
    })

    it("should handle value changes", async () => {
      const props = getProps({
        default: [1, 9],
      })
      const wrapper = shallow(<Slider {...props} />)

      // @ts-ignore
      wrapper.find(UISlider).prop("onChange")({
        value: [1, 10],
      })

      // We need to do this as we are using a debounce when the widget value is set
      jest.runAllTimers()

      expect(props.widgetMgr.setFloatArrayValue).toHaveBeenCalledWith(
        props.element.get("id"),
        [1, 10],
        { fromUi: true }
      )
      expect(wrapper.find(UISlider).prop("value")).toStrictEqual([1, 10])
    })
  })

  describe("Datetime slider", () => {
    TimezoneMock.register("UTC")

    it("should be in UTC", () => {
      // We use a less idiomiatic Jest call, since getTimezoneOffset can return
      // -0, and Object.is(-0, 0) is false: https://stackoverflow.com/a/59343755
      expect(new Date().getTimezoneOffset() === 0).toBeTruthy()
    })

    const WEEK_IN_MICROS = 7 * 24 * 60 * 60 * 1000 * 1000
    const props = getProps({
      min: 0,
      max: 4 * WEEK_IN_MICROS,
      format: "YYYY-MM-DD",
      dataType: SliderProto.DataType.DATETIME,
    })
    const wrapper = shallow(<Slider {...props} />)

    it("should format the value as a date", () => {
      // @ts-ignore
      const thumbValue = wrapper
        .find(UISlider)
        .prop("overrides")
        // @ts-ignore
        .ThumbValue({
          $thumbIndex: 0,
          $value: [2 * WEEK_IN_MICROS],
        })

      const thumbValueWrapper = shallow(thumbValue)

      expect(thumbValueWrapper.text()).toBe("1970-01-15")
    })

    it("should format min and max as dates", () => {
      // @ts-ignore
      const thumbValue = wrapper
        .find(UISlider)
        .prop("overrides")
        // @ts-ignore
        .TickBar()

      const thumbValueWrapper = shallow(thumbValue)

      expect(thumbValueWrapper.find(".tickBarMin").text()).toBe("1970-01-01")
      expect(thumbValueWrapper.find(".tickBarMax").text()).toBe("1970-01-29")
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
      const wrapper = mount(<Slider {...props} />)

      expect(wrapper).toBeDefined()
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
      const wrapper = mount(<Slider {...props} />)
      const sliderDOMNodes = wrapper.find("div[role='slider']")
      sliderDOMNodes.forEach(node => {
        expect(node.getDOMNode().getAttribute("aria-valuetext")).toEqual(
          "orange"
        )
      })
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
      const wrapper = mount(<Slider {...props} />)
      wrapper.setState({ value: [4] })
      const sliderDOMNodes = wrapper.find("div[role='slider']")
      sliderDOMNodes.forEach(node => {
        expect(node.getDOMNode().getAttribute("aria-valuetext")).toEqual(
          "blue"
        )
      })
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
      const wrapper = mount(<Slider {...props} />)
      const sliderDOMNodes = wrapper.find("div[role='slider']")
      const ariaTexts = sliderDOMNodes.map(node =>
        node.getDOMNode().getAttribute("aria-valuetext")
      )

      expect(ariaTexts).toEqual(["orange", "blue"])
    })
  })
})
