import React from "react"
import { mount } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import { Radio as UIRadio, RadioGroup } from "baseui/radio"
import { Radio as RadioProto } from "src/autogen/proto"
import Radio, { Props } from "./Radio"

const getProps = (elementProps: Partial<RadioProto> = {}): Props => ({
  element: RadioProto.create({
    id: "1",
    label: "Label",
    default: 0,
    options: ["a", "b", "c"],
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("Radio widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)

    expect(wrapper.find(RadioGroup).length).toBe(1)
    expect(wrapper.find(UIRadio).length).toBe(3)
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")
    mount(<Radio {...props} />)

    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stRadio")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("has a default value", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find(RadioGroup).prop("value")).toBe(
      props.element.default.toString()
    )
  })

  it("can be disabled", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find(RadioGroup).prop("disabled")).toBe(props.disabled)
  })

  it("has the correct options", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    const options = wrapper.find(UIRadio)

    options.forEach((option, index) => {
      expect(option.prop("value")).toBe(index.toString())
      expect(option.prop("children")).toBe(props.element.options[index])
    })
  })

  it("shows a message when there are no options to be shown", () => {
    const props = getProps({ options: [] })
    const wrapper = mount(<Radio {...props} />)

    expect(wrapper.find(UIRadio).length).toBe(1)
    expect(wrapper.find(UIRadio).prop("children")).toBe(
      "No options to select."
    )
  })

  it("sets the widget value when an option is selected", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")
    const wrapper = mount(<Radio {...props} />)

    // @ts-ignore
    wrapper.find(RadioGroup).prop("onChange")({
      target: { value: "1" },
    } as React.ChangeEvent<HTMLInputElement>)
    wrapper.update()

    expect(wrapper.find(RadioGroup).prop("value")).toBe("1")
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")

    const wrapper = mount(<Radio {...props} />)

    // Change the widget value
    // @ts-ignore
    wrapper.find(RadioGroup).prop("onChange")({
      target: { value: "1" },
    } as React.ChangeEvent<HTMLInputElement>)
    wrapper.update()

    expect(wrapper.find(RadioGroup).prop("value")).toBe("1")
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(wrapper.find(RadioGroup).prop("value")).toBe(
      props.element.default.toString()
    )
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})
