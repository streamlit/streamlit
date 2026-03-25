/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { screen } from "@testing-library/react"
import { BaseProvider, LightTheme } from "baseui"

import { render } from "~lib/test_util"
import { sizes } from "~lib/theme/primitives/sizes"

import Modal, { calculateModalSize } from "./Modal"

describe("Modal component", () => {
  it("renders without crashing", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Modal isOpen />
      </BaseProvider>
    )

    const modalElement = screen.getByTestId("stDialog")
    expect(modalElement).toBeInTheDocument()
    expect(modalElement).toHaveClass("stDialog")
  })

  it("resets scroll position to top when opened", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Modal isOpen>
          <div style={{ height: "2000px" }}>Tall content</div>
        </Modal>
      </BaseProvider>
    )

    // The DialogContainer is the scrollable wrapper inside the Modal root.
    // Verify its scrollTop is 0 when the modal opens.
    const modalRoot = screen.getByTestId("stDialog")
    const dialogContainer = modalRoot.firstElementChild as HTMLElement
    expect(dialogContainer.scrollTop).toBe(0)
  })
})
describe("calculateModalSize", () => {
  it("returns the default size when no size is provided", () => {
    const size = calculateModalSize(undefined)
    expect(size).toBe("default")
  })
  it("returns the auto size when passed size is 'auto'", () => {
    const size = calculateModalSize("auto")
    expect(size).toBe("auto")
  })
  it("calculates the size based on the spacing and content width when size is 'medium'", () => {
    const size = calculateModalSize("medium", "100px", "100px")
    expect(size).toBe("calc(100px + 100px)")
  })

  it("calculates the size based on the spacing and content width when size is 'large'", () => {
    const size = calculateModalSize("large", "100px", "100px", "80rem")
    expect(size).toBe(sizes.dialogLargeWidth)
  })
})
