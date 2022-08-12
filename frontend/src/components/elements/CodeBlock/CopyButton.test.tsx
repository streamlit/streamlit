import React from "react"
import Clipboard from "clipboard"
import { shallow, mount } from "src/lib/test_util"

import CopyButton from "./CopyButton"

jest.mock("clipboard")

describe("CopyButton Element", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const wrapper = shallow(<CopyButton text="test" />)

  it("renders without crashing", () => {
    expect(wrapper.find("StyledCopyButton").length).toBe(1)
  })

  describe("attributes", () => {
    it("should have title", () => {
      expect(wrapper.find("StyledCopyButton").prop("title")).toBe(
        "Copy to clipboard"
      )
    })

    it("should have clipboard text", () => {
      expect(
        wrapper.find("StyledCopyButton").prop("data-clipboard-text")
      ).toBe("test")
    })
  })

  it("should unmount", () => {
    wrapper.unmount()

    expect(wrapper.html()).toBeNull()
  })

  describe("calling clipboard", () => {
    it("should be called on did mount", () => {
      mount(<CopyButton text="test" />)

      expect(Clipboard).toHaveBeenCalled()
    })

    it("should be called on unmount", () => {
      const wrapper = mount(<CopyButton text="test" />)

      wrapper.unmount()

      // @ts-ignore
      const mockClipboard = Clipboard.mock.instances[0]
      const mockDestroy = mockClipboard.destroy

      expect(mockDestroy).toHaveBeenCalled()
    })
  })
})
