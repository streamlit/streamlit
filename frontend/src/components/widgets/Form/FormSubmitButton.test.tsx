import { screen } from "@testing-library/dom"
import userEvent from "@testing-library/user-event"
import { enableAllPlugins } from "immer"
import React from "react"

import { Button as ButtonProto } from "src/autogen/proto"

import UIButton from "src/components/shared/Button"
import { render, shallow } from "src/lib/test_util"
import {
  createFormsData,
  FormsData,
  WidgetStateManager,
} from "src/lib/WidgetStateManager"
import { FormSubmitButton, Props } from "./FormSubmitButton"

// Required by ImmerJS
enableAllPlugins()

describe("FormSubmitButton", () => {
  let formsData: FormsData
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    formsData = createFormsData()
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(newData => {
        formsData = newData
      }),
    })
  })

  function getProps(props: Partial<Props> = {}): Props {
    return {
      element: ButtonProto.create({
        id: "1",
        label: "Submit",
        formId: "mockFormId",
        help: "mockHelpText",
      }),
      disabled: false,
      hasInProgressUpload: false,
      width: 0,
      widgetMgr,
      ...props,
    }
  }

  it("renders without crashing", () => {
    render(<FormSubmitButton {...getProps()} />)
  })

  it("has correct className and style", () => {
    const wrapper = shallow(<FormSubmitButton {...getProps()} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const classNameParts = className.split(" ")

    expect(classNameParts).toContain("stButton")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const wrapper = shallow(<FormSubmitButton {...getProps()} />)

    const wrappedUIButton = wrapper.find(UIButton)

    expect(wrappedUIButton.length).toBe(1)
    expect(wrappedUIButton.props().children).toBe(getProps().element.label)
  })

  it("calls submitForm when clicked", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "submitForm")

    render(<FormSubmitButton {...props} />)

    userEvent.click(screen.getByRole("button"))
    expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(props.element)
  })

  it("is disabled when form has pending upload", () => {
    const props = getProps({ hasInProgressUpload: true })
    render(<FormSubmitButton {...props} />)

    const button = screen.getByRole("button") as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it("increments submitButtonCount on mount and decrements on unmount", () => {
    expect(formsData.submitButtonCount.get("mockFormId")).toBeUndefined()

    const props = getProps()

    const wrapper1 = render(<FormSubmitButton {...props} />)
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(1)

    const wrapper2 = render(<FormSubmitButton {...props} />)
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(2)

    wrapper1.unmount()
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(1)

    wrapper2.unmount()
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(0)
  })
})
