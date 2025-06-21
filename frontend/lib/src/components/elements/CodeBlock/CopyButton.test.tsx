/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"

import { screen } from "@testing-library/react"
import Clipboard from "clipboard"

import { render } from "~lib/test_util"

import CopyButton from "./CopyButton"

vi.mock("clipboard")

describe("CopyButton Element", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders without crashing", () => {
    render(<CopyButton text="test" />)
    expect(screen.getByTestId("stCodeCopyButton")).toBeInTheDocument()
  })

  describe("attributes", () => {
    it("should have title", () => {
      render(<CopyButton text="test" />)
      expect(screen.getByTestId("stCodeCopyButton")).toHaveAttribute(
        "title",
        "Copy to clipboard"
      )
    })

    it("should have clipboard text", () => {
      render(<CopyButton text="test" />)
      expect(screen.getByTestId("stCodeCopyButton")).toHaveAttribute(
        "data-clipboard-text",
        "test"
      )
    })
  })

  describe("calling clipboard", () => {
    it("should be called on did mount", () => {
      render(<CopyButton text="test" />)

      expect(Clipboard).toHaveBeenCalled()
    })

    it("should be called on unmount", () => {
      const { unmount } = render(<CopyButton text="test" />)

      unmount()

      // @ts-expect-error
      const mockClipboard = Clipboard.mock.instances[0]
      const mockDestroy = mockClipboard.destroy

      expect(mockDestroy).toHaveBeenCalled()
    })
  })
})
