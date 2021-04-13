/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

      const mockClipboard = Clipboard.mock.instances[0]
      const mockDestroy = mockClipboard.destroy

      expect(mockDestroy).toHaveBeenCalled()
    })
  })
})
