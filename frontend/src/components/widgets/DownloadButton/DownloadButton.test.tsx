import React from "react"
import { shallow } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import UIButton from "src/components/shared/Button"

import { DownloadButton as DownloadButtonProto } from "src/autogen/proto"
import DownloadButton, { Props } from "./DownloadButton"

jest.mock("src/lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: Partial<DownloadButtonProto> = {}): Props => ({
  element: DownloadButtonProto.create({
    id: "1",
    label: "Label",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  // @ts-ignore
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("DownloadButton widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<DownloadButton {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("should have correct className and style", () => {
    const wrapper = shallow(<DownloadButton {...getProps()} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stDownloadButton")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label within the button", () => {
    const wrapper = shallow(<DownloadButton {...getProps()} />)

    const wrappedUIButton = wrapper.find(UIButton)

    expect(wrappedUIButton.length).toBe(1)
    expect(wrappedUIButton.props().children).toBe(getProps().element.label)
  })

  describe("UIButton props should work", () => {
    it("onClick prop", () => {
      const props = getProps()
      const wrapper = shallow(<DownloadButton {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      wrappedUIButton.simulate("click")

      expect(
        props.widgetMgr.setTriggerValue
      ).toHaveBeenCalledWith(props.element, { fromUi: true })
    })

    it("disable prop", () => {
      const props = getProps()
      const wrapper = shallow(<DownloadButton {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      expect(wrappedUIButton.props().disabled).toBe(props.disabled)
    })
  })
})
