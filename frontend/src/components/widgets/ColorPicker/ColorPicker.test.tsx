import { ReactWrapper } from "enzyme"
import React from "react"
import { mount } from "src/lib/test_util"
import { StatefulPopover as UIPopover } from "baseui/popover"
import { ColorPicker as ColorPickerProto } from "src/autogen/proto"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { ChromePicker } from "react-color"
import { StyledChromePicker } from "src/components/shared/ColorPicker/styled-components"

import ColorPicker, { Props } from "./ColorPicker"

const getProps = (elementProps: Partial<ColorPickerProto> = {}): Props => ({
  element: ColorPickerProto.create({
    id: "1",
    label: "Label",
    default: "#000000",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

/** Return the ColorPicker's popover (where the color picking happens). */
function getPopoverWrapper(wrapper: ReactWrapper<ColorPicker>): any {
  // @ts-ignore
  return (
    wrapper
      .find(UIPopover)
      // @ts-ignore
      .renderProp("content")(null)
      .find(StyledChromePicker)
  )
}

/** Return the ColorPicker's currently-selected color as a hex string. */
function getPickedColor(wrapper: ReactWrapper<ColorPicker>): string {
  return getPopoverWrapper(wrapper).prop("children").props.color
}

/** Simulate selecting a new color with the ColorPicker's UI. */
function selectColor(wrapper: ReactWrapper<ColorPicker>, color: string): void {
  // Open the popover, select the new color, close the popover.
  wrapper.find(UIPopover).simulate("click")
  getPopoverWrapper(wrapper)
    .find(ChromePicker)
    .prop("onChange")({
    hex: color,
  })
  wrapper.find(UIPopover).simulate("click")
}

describe("ColorPicker widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<ColorPicker {...props} />)

    expect(wrapper.find(UIPopover).length).toBe(1)
    expect(getPopoverWrapper(wrapper).find(ChromePicker).length).toBe(1)
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")

    mount(<ColorPicker {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("renders a default color in the preview and the color picker", () => {
    const props = getProps()
    const wrapper = mount(<ColorPicker {...props} />)

    wrapper.find(UIPopover).simulate("click")

    expect(wrapper.find("StyledColorBlock").prop("style")).toEqual({
      backgroundColor: "#000000",
      opacity: "",
    })

    expect(getPickedColor(wrapper)).toEqual("#000000")
  })

  it("updates its widget value when it's changed", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")

    const wrapper = mount(<ColorPicker {...props} />)

    const newColor = "#E91E63"
    selectColor(wrapper, newColor)

    // Our widget should be updated.
    expect(getPickedColor(wrapper)).toEqual(newColor)

    // And the WidgetMgr should also be updated.
    expect(
      props.widgetMgr.setStringValue
    ).toHaveBeenLastCalledWith(props.element, newColor, { fromUi: true })
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    jest.spyOn(props.widgetMgr, "setStringValue")
    props.widgetMgr.setFormClearOnSubmit("form", true)

    const wrapper = mount(<ColorPicker {...props} />)

    // Choose a new color
    const newColor = "#E91E63"
    selectColor(wrapper, newColor)

    expect(getPickedColor(wrapper)).toEqual(newColor)
    expect(
      props.widgetMgr.setStringValue
    ).toHaveBeenLastCalledWith(props.element, newColor, { fromUi: true })

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(getPickedColor(wrapper)).toEqual(props.element.default)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})
