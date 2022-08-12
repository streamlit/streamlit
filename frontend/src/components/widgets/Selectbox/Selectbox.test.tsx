import React from "react"
import { mount } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import { Select as UISelect } from "baseui/select"
import { Selectbox as SelectboxProto } from "src/autogen/proto"
import Selectbox, { Props } from "./Selectbox"

const getProps = (elementProps: Partial<SelectboxProto> = {}): Props => ({
  element: SelectboxProto.create({
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

describe("Selectbox widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Selectbox {...props} />)
    expect(wrapper.find(UISelect).length).toBeTruthy()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")

    mount(<Selectbox {...props} />)
    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("handles the onChange event", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")

    const wrapper = mount(<Selectbox {...props} />)

    // @ts-ignore
    wrapper.find(UISelect).prop("onChange")({
      value: [{ label: "b", value: "1" }],
      option: { label: "b", value: "1" },
      type: "select",
    })

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )
    expect(wrapper.state("value")).toBe(1)
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")

    const wrapper = mount(<Selectbox {...props} />)

    // Change the widget value
    // @ts-ignore
    wrapper.find(UISelect).prop("onChange")({
      value: [{ label: "b", value: "1" }],
      option: { label: "b", value: "1" },
      type: "select",
    })

    expect(wrapper.state("value")).toBe(1)
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(wrapper.state("value")).toBe(props.element.default)
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})
