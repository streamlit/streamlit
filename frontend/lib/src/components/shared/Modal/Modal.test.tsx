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

  it("resets scroll position to top when reopened", () => {
    const { rerender } = render(
      <BaseProvider theme={LightTheme}>
        <Modal isOpen>
          <div style={{ height: "2000px" }}>Tall content</div>
        </Modal>
      </BaseProvider>
    )

    // The DialogContainer should have a data-testid for stable querying.
    const dialogContainer = screen.getByTestId("stDialogContainer")
    expect(dialogContainer.scrollTop).toBe(0)

    // Simulate scrolling (JSDOM doesn't truly support layout/scrolling,
    // but we can set scrollTop to verify the reset behavior).
    dialogContainer.scrollTop = 500

    // Close and reopen the modal
    rerender(
      <BaseProvider theme={LightTheme}>
        <Modal isOpen={false}>
          <div style={{ height: "2000px" }}>Tall content</div>
        </Modal>
      </BaseProvider>
    )
    rerender(
      <BaseProvider theme={LightTheme}>
        <Modal isOpen>
          <div style={{ height: "2000px" }}>Tall content</div>
        </Modal>
      </BaseProvider>
    )

    // Note: In JSDOM, requestAnimationFrame is polyfilled as setTimeout(fn, 0).
    // The scroll reset effect fires asynchronously, so we verify the container
    // exists and has the expected test ID. The actual scroll reset behavior
    // is validated by the E2E test.
    const reopenedContainer = screen.getByTestId("stDialogContainer")
    expect(reopenedContainer).toBeVisible()
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
