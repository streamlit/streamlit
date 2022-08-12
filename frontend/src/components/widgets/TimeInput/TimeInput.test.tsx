import React from "react"
import moment from "moment"
import { mount, shallow } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  TimeInput as TimeInputProto,
} from "src/autogen/proto"

import { TimePicker as UITimePicker } from "baseui/timepicker"
import TimeInput, { Props } from "./TimeInput"

const getProps = (elementProps: Partial<TimeInputProto> = {}): Props => ({
  element: TimeInputProto.create({
    id: "123",
    label: "Label",
    default: "12:45",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("TimeInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<TimeInput {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("shows a label", () => {
    const props = getProps()
    const wrapper = mount(<TimeInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = mount(<TimeInput {...props} />)
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
    const wrapper = mount(<TimeInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    shallow(<TimeInput {...props} />)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = shallow(<TimeInput {...props} />)
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stTimeInput")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("can be disabled", () => {
    const props = getProps()
    const wrapper = shallow(<TimeInput {...props} />)
    expect(wrapper.find(UITimePicker).prop("overrides")).toMatchObject({
      Select: {
        props: {
          disabled: props.disabled,
        },
      },
    })
  })

  it("has the correct default value", () => {
    const props = getProps()
    const wrapper = shallow(<TimeInput {...props} />)
    const wrapperValue = wrapper.find(UITimePicker).prop("value")

    // @ts-ignore
    expect(moment(wrapperValue).format("hh:mm")).toBe("12:45")
  })

  it("has a 24 format", () => {
    const props = getProps()
    const wrapper = shallow(<TimeInput {...props} />)
    expect(wrapper.find(UITimePicker).prop("format")).toBe("24")
  })

  it("sets the widget value on change", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TimeInput {...props} />)
    const date = new Date(1995, 10, 10, 12, 8)

    // @ts-ignore
    wrapper.find(UITimePicker).prop("onChange")(date)

    expect(wrapper.state("value")).toBe("12:08")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "12:08",
      { fromUi: true }
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringValue")

    const wrapper = shallow(<TimeInput {...props} />)

    // Change the widget value
    const date = new Date(1995, 10, 10, 12, 8)
    // @ts-ignore
    wrapper.find(UITimePicker).prop("onChange")(date)

    expect(wrapper.state("value")).toBe("12:08")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "12:08",
      { fromUi: true }
    )

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(wrapper.state("value")).toBe(props.element.default)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})
