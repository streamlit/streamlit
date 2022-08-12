import React from "react"
import { BaseProvider, LightTheme } from "baseui"

import { ModalHeader, ModalBody } from "src/components/shared/Modal"
import { mount } from "src/lib/test_util"
import UnsupportedBrowserDialog from "./UnsupportedBrowserDialog"

describe("UnsupportedBrowserDialog", () => {
  it("renders without crashing", () => {
    const wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <UnsupportedBrowserDialog onClose={() => {}} />
      </BaseProvider>
    )

    expect(wrapper.html()).not.toBeNull()
  })

  it("should render a header", () => {
    const onClose = jest.fn()
    const wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <UnsupportedBrowserDialog onClose={onClose} />
      </BaseProvider>
    )
    const headerWrapper = wrapper.find(ModalHeader)
    expect(headerWrapper.props().children).toBe("Record a screencast")
  })

  it("should render a body with the correct message", () => {
    const wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <UnsupportedBrowserDialog onClose={() => {}} />
      </BaseProvider>
    )
    const bodyWrapper = wrapper.find(ModalBody)

    expect(bodyWrapper.find("span[aria-label='Alien Monster']").text()).toBe(
      "👾"
    )
    expect(
      bodyWrapper.find("StyledUnsupportedScreenCastExplanation").text()
    ).toBe(
      "Due to limitations with some browsers, this feature is only supported on recent desktop versions of Chrome, Firefox, and Edge."
    )
  })
})
