/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { mount } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import { Select as UISelect, TYPE } from "baseui/select"
import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  MultiSelect as MultiSelectProto,
} from "src/autogen/proto"
import { lightTheme } from "src/theme"
import Multiselect, { Props } from "./Multiselect"

const getProps = (elementProps: Partial<MultiSelectProto> = {}): Props => ({
  element: MultiSelectProto.create({
    id: "1",
    label: "Label",
    default: [0],
    options: ["a", "b", "c"],
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  theme: lightTheme.emotion,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("Multiselect widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    expect(wrapper.find(UISelect).length).toBeTruthy()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntArrayValue")

    mount(<Multiselect {...props} />)
    expect(props.widgetMgr.setIntArrayValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-expect-error
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stMultiSelect")

    // @ts-expect-error
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = mount(<Multiselect {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<Multiselect {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  describe("placeholder", () => {
    it("renders when it's not empty", () => {
      const props = getProps()
      const wrapper = mount(<Multiselect {...props} />)
      expect(wrapper.find(UISelect).prop("placeholder")).toBe(
        "Choose an option"
      )
    })

    it("renders with empty options", () => {
      const props = getProps({ options: [] })
      const wrapper = mount(<Multiselect {...props} />)

      expect(wrapper.find(UISelect).prop("placeholder")).toBe(
        "No options to select."
      )
    })
  })

  it("renders options", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    // @ts-expect-error
    const options = (wrapper.find(UISelect).prop("options") as string[]) || []

    options.forEach(option => {
      expect(option).toHaveProperty("label")
      expect(option).toHaveProperty("value")
    })

    expect(options.length).toBe(props.element.options.length)
    expect(wrapper.find(UISelect).prop("labelKey")).toBe("label")
    expect(wrapper.find(UISelect).prop("valueKey")).toBe("value")
  })

  it("filters based on label, not value", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)

    const options = wrapper.find(UISelect).prop("options") || []
    const filterOptionsFn =
      wrapper.find(UISelect).prop("filterOptions") || (() => [])

    // @ts-expect-error filterOptionsFn expects readonly options
    expect(filterOptionsFn(options, "1").length).toEqual(0)
    // @ts-expect-error filterOptionsFn expects readonly options
    expect(filterOptionsFn(options, "b").length).toEqual(1)
  })

  it("has multi attr", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    expect(wrapper.find(UISelect).prop("multi")).toBeDefined()
  })

  it("has correct type", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    expect(wrapper.find(UISelect).prop("type")).toBe(TYPE.select)
  })

  it("can be disabled", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    expect(wrapper.find(UISelect).prop("disabled")).toBe(props.disabled)
  })

  it("can select multiple options", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)

    // @ts-expect-error
    wrapper.find(UISelect).prop("onChange")({
      type: "select",
      option: {
        value: 1,
      },
    })
    wrapper.update()

    expect(wrapper.find(UISelect).prop("value")).toStrictEqual([
      { label: "a", value: "0" },
      { label: "b", value: "1" },
    ])
  })

  it("can remove options", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)

    // @ts-expect-error
    wrapper.find(UISelect).prop("onChange")({
      type: "remove",
      option: {
        value: 1,
      },
    })
    wrapper.update()

    expect(wrapper.find(UISelect).prop("value")).toStrictEqual([
      { label: "a", value: "0" },
    ])
  })

  it("can clear", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)

    // @ts-expect-error
    wrapper.find(UISelect).prop("onChange")({ type: "clear" })
    wrapper.update()

    expect(wrapper.find(UISelect).prop("value")).toStrictEqual([])
  })

  it("throws an exception when state transition is unknown", () => {
    const props = getProps()
    const wrapper = mount(<Multiselect {...props} />)
    const UNKNOWN_TRANSITION = "UNKNOWN_TRANSITION"
    const onChange = wrapper.find(UISelect).prop("onChange")

    // @ts-expect-error
    expect(() => onChange({ type: UNKNOWN_TRANSITION })).toThrow(
      `State transition is unknown: ${UNKNOWN_TRANSITION}`
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntArrayValue")

    const wrapper = mount(<Multiselect {...props} />)

    // Change the widget value
    // @ts-expect-error
    wrapper.find(UISelect).prop("onChange")({
      type: "select",
      option: {
        value: 1,
      },
    })
    wrapper.update()

    expect(wrapper.find(UISelect).prop("value")).toStrictEqual([
      { label: "a", value: "0" },
      { label: "b", value: "1" },
    ])

    expect(props.widgetMgr.setIntArrayValue).toHaveBeenCalledWith(
      props.element,
      [0, 1],
      {
        fromUi: true,
      }
    )

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    const defaultValue = props.element.default.map(value => ({
      label: props.element.options[value],
      value: value.toString(),
    }))
    expect(wrapper.find(UISelect).prop("value")).toStrictEqual(defaultValue)
    expect(props.widgetMgr.setIntArrayValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
  describe("properly invalidates going over max selections", () => {
    it("has correct noResultsMsg when maxSelections is not passed", () => {
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0],
          options: ["a", "b", "c"],
        })
      )
      const wrapper = mount(<Multiselect {...props} />)

      expect(wrapper.find(UISelect).props()).toHaveProperty(
        "noResultsMsg",
        "No results"
      )
    })

    it("has correct noResultsMsg when maxSelections is passed", () => {
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0, 1],
          options: ["a", "b", "c"],
          maxSelections: 2,
        })
      )
      const wrapper = mount(<Multiselect {...props} />)

      expect(wrapper.find(UISelect).props()).toHaveProperty(
        "noResultsMsg",
        "You can only select up to 2 options. Remove an option first."
      )
    })

    it("has correct noResultsMsg when maxSelections === 1", () => {
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0, 1],
          options: ["a", "b", "c"],
          maxSelections: 1,
        })
      )
      const wrapper = mount(<Multiselect {...props} />)

      expect(wrapper.find(UISelect).prop("noResultsMsg")).toBe(
        "You can only select up to 1 option. Remove an option first."
      )
    })

    it("does not allow for more selection when an option is picked", () => {
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0],
          options: ["a", "b", "c"],
          maxSelections: 1,
        })
      )
      const wrapper = mount(<Multiselect {...props} />)

      // @ts-expect-error
      wrapper.find(UISelect).prop("onChange")({
        type: "select",
        option: {
          value: 1,
        },
      })
      wrapper.update()

      expect(wrapper.find(UISelect).prop("value")).toStrictEqual([
        { label: "a", value: "0" },
      ])
    })

    it("does allow an option to be removed when we are at max selections", () => {
      const props = getProps(
        MultiSelectProto.create({
          id: "1",
          label: "Label",
          default: [0, 1],
          options: ["a", "b", "c"],
          maxSelections: 2,
        })
      )
      const wrapper = mount(<Multiselect {...props} />)

      // @ts-expect-error
      wrapper.find(UISelect).prop("onChange")({
        type: "remove",
        option: {
          value: 1,
        },
      })
      wrapper.update()

      expect(wrapper.find(UISelect).prop("value")).toStrictEqual([
        { label: "a", value: "0" },
      ])
    })
  })
})
