import React from "react"
import { mount, shallow } from "src/lib/test_util"
import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  TextArea as TextAreaProto,
} from "src/autogen/proto"

import { WidgetStateManager } from "src/lib/WidgetStateManager"

import { Textarea as UITextArea } from "baseui/textarea"
import TextArea, { Props } from "./TextArea"

const getProps = (elementProps: Partial<TextAreaProto> = {}): Props => ({
  element: TextAreaProto.create({
    id: "1",
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("TextArea widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} />)

    expect(wrapper.find(UITextArea).length).toBe(1)
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    shallow(<TextArea {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stTextArea")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = mount(<TextArea {...props} />)

    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<TextArea {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<TextArea {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("has a default value", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} />)

    expect(wrapper.find(UITextArea).prop("value")).toBe(props.element.default)
  })

  it("renders a placeholder", () => {
    const props = getProps()
    const wrapper = mount(<TextArea {...props} />)

    expect(wrapper.find(UITextArea).prop("placeholder")).toBe(
      props.element.placeholder
    )
  })

  it("can be disabled", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} />)

    expect(wrapper.find(UITextArea).prop("disabled")).toBe(props.disabled)
  })

  it("sets widget value on blur", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextArea {...props} />)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: { value: "testing" },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onBlur")()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      }
    )
  })

  it("sets widget value when ctrl+enter is pressed", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextArea {...props} />)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: { value: "testing" },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onKeyDown")({
      preventDefault: jest.fn(),
      ctrlKey: true,
      key: "Enter",
    })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      }
    )
  })

  it("sets widget height if it is passed from props", () => {
    const props = getProps({
      height: 500,
    })
    const wrapper = shallow(<TextArea {...props} />)
    const overrides = wrapper.find(UITextArea).prop("overrides")

    // @ts-ignore
    const { height, resize } = overrides.Input.style

    expect(height).toBe("500px")
    expect(resize).toBe("vertical")
  })

  it("limits the length if max_chars is passed", () => {
    const props = getProps({
      height: 500,
      maxChars: 10,
    })
    const wrapper = shallow(<TextArea {...props} />)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: { value: "0123456789" },
    } as EventTarget)

    expect(wrapper.find(UITextArea).prop("value")).toBe("0123456789")

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: { value: "0123456789a" },
    } as EventTarget)

    expect(wrapper.find(UITextArea).prop("value")).toBe("0123456789")
  })

  it("updates widget value on text changes when inside of a form", () => {
    const props = getProps({ formId: "form" })
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextArea {...props} />)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: { value: "TEST" },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    expect(wrapper.state("dirty")).toBe(false)

    // Check that the last call used the TEST value.
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "TEST",
      {
        fromUi: true,
      }
    )
  })

  it("does not update widget value on text changes when outside of a form", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextArea {...props} />)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: { value: "TEST" },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    expect(wrapper.state("dirty")).toBe(true)

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      }
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringValue")

    const wrapper = shallow(<TextArea {...props} />)

    // Change the widget value
    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: { value: "TEST" },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    expect(wrapper.state("value")).toBe("TEST")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "TEST",
      {
        fromUi: true,
      }
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

  describe("on mac", () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
    })

    it("sets widget value when ⌘+enter is pressed", () => {
      const props = getProps()
      jest.spyOn(props.widgetMgr, "setStringValue")
      const wrapper = shallow(<TextArea {...props} />)

      // @ts-ignore
      wrapper.find(UITextArea).prop("onChange")({
        target: { value: "testing" },
      } as React.ChangeEvent<HTMLTextAreaElement>)

      // @ts-ignore
      wrapper.find(UITextArea).prop("onKeyDown")({
        preventDefault: jest.fn(),
        metaKey: true,
        key: "Enter",
      })

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "testing",
        {
          fromUi: true,
        }
      )
    })
  })
})
