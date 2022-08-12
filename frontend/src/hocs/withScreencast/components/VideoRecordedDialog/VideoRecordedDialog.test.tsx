import React from "react"
import { BaseProvider, LightTheme } from "baseui"
import { ReactWrapper } from "enzyme"

import Modal, { ModalHeader, ModalBody } from "src/components/shared/Modal"
import { mount } from "src/lib/test_util"
import VideoRecordedDialog, { Props } from "./VideoRecordedDialog"

URL.createObjectURL = jest.fn()

const getProps = (props: Partial<Props> = {}): Props => ({
  fileName: "test",
  onClose: jest.fn(),
  videoBlob: new Blob(),
  ...props,
})

describe("VideoRecordedDialog", () => {
  const props = getProps()
  let wrapper: ReactWrapper

  beforeEach(() => {
    wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <VideoRecordedDialog {...props} />
      </BaseProvider>
    )
  })

  afterEach(() => {
    wrapper.unmount()
  })

  it("renders without crashing", () => {
    expect(wrapper.html()).not.toBeNull()
  })

  it("should render a header", () => {
    const headerWrapper = wrapper.find(ModalHeader)
    expect(headerWrapper.props().children).toBe("Next steps")
  })

  it("should render a video", () => {
    const bodyWrapper = wrapper.find(ModalBody)

    expect(bodyWrapper.find("StyledVideo").length).toBe(1)
    expect(URL.createObjectURL).toBeCalled()
  })

  it("should render a download button", () => {
    const buttonWrapper = wrapper.find(ModalBody).find("button")

    buttonWrapper.simulate("click")

    expect(buttonWrapper.length).toBe(1)
    expect(props.onClose).toBeCalled()
  })

  it("should render a Modal with overridden width", () => {
    const overrides = wrapper.find(Modal).prop("overrides")
    // @ts-ignore
    expect(overrides.Dialog.style.width).toEqual("80vw")
  })
})
