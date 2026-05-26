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
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import { BaseButtonKind } from "~lib/components/shared/BaseButton/BaseButton"
import { render } from "~lib/test_util"

import Modal, {
  calculateModalSize,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
} from "./Modal"

describe("Modal component", () => {
  it("renders without crashing", () => {
    render(<Modal isOpen />)

    const modalElement = screen.getByTestId("stDialog")
    expect(modalElement).toBeVisible()
    expect(modalElement).toHaveClass("stDialog")
  })

  it("renders the dialog with correct ARIA role", () => {
    render(
      <Modal isOpen>
        <ModalBody>Content</ModalBody>
      </Modal>
    )

    expect(screen.getByRole("dialog")).toBeVisible()
  })

  it("renders the close button when closeable is true", () => {
    render(<Modal isOpen closeable />)

    expect(screen.getByRole("button", { name: "Close" })).toBeVisible()
  })

  it("does not render the close button when closeable is false", () => {
    render(<Modal isOpen closeable={false} />)

    expect(
      screen.queryByRole("button", { name: "Close" })
    ).not.toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(<Modal isOpen onClose={handleClose} />)

    await user.click(screen.getByRole("button", { name: "Close" }))

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when Escape key is pressed", async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(<Modal isOpen onClose={handleClose} />)

    await user.keyboard("{Escape}")

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when clicking the backdrop", async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(<Modal isOpen onClose={handleClose} />)

    // Click the overlay element (outside the dialog panel) to trigger backdrop dismiss.
    await user.click(screen.getByTestId("stDialog"))

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("does not call onClose on Escape when closeable is false", async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(<Modal isOpen closeable={false} onClose={handleClose} />)

    await user.keyboard("{Escape}")

    expect(handleClose).not.toHaveBeenCalled()
  })

  it("does not call onClose on backdrop click when closeable is false", async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(<Modal isOpen closeable={false} onClose={handleClose} />)

    await user.click(screen.getByTestId("stDialog"))

    expect(handleClose).not.toHaveBeenCalled()
  })

  it("does not render anything when isOpen is false", () => {
    render(<Modal isOpen={false} />)

    expect(screen.queryByTestId("stDialog")).not.toBeInTheDocument()
  })
})

describe("calculateModalSize", () => {
  it("returns '31.25rem' (default width) when no size is provided", () => {
    const size = calculateModalSize(undefined)
    expect(size).toBe("31.25rem")
  })

  it("returns undefined (content-sized) when size is 'auto'", () => {
    const size = calculateModalSize("auto")
    expect(size).toBeUndefined()
  })

  it("calculates the size based on width and padding when size is 'medium'", () => {
    const size = calculateModalSize("medium", "100px", "100px")
    expect(size).toBe("calc(100px + 100px)")
  })

  it("returns the caller-supplied largeWidth when size is 'large'", () => {
    const size = calculateModalSize("large", "100px", "100px", "77rem")
    expect(size).toBe("77rem")
  })

  it("returns '31.25rem' when 'medium' is provided without width and padding", () => {
    expect(calculateModalSize("medium")).toBe("31.25rem")
  })

  it("returns '31.25rem' when 'large' is provided without a largeWidth", () => {
    expect(calculateModalSize("large", "100px", "100px")).toBe("31.25rem")
  })
})

describe("Modal subcomponents", () => {
  it("renders the modal header content", () => {
    render(
      <Modal isOpen>
        <ModalHeader>Header Title</ModalHeader>
      </Modal>
    )
    expect(screen.getByText("Header Title")).toBeVisible()
  })

  it("labels the dialog with the modal header text via aria-labelledby", () => {
    render(
      <Modal isOpen>
        <ModalHeader>My Dialog Title</ModalHeader>
      </Modal>
    )
    const dialog = screen.getByRole("dialog")
    const labelledById = dialog.getAttribute("aria-labelledby")
    expect(labelledById).toBeTruthy()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by toBeTruthy above
    expect(document.getElementById(labelledById!)).toHaveTextContent(
      "My Dialog Title"
    )
  })

  it("renders the modal body content", () => {
    render(
      <Modal isOpen>
        <ModalBody>Body Content</ModalBody>
      </Modal>
    )
    expect(screen.getByText("Body Content")).toBeVisible()
  })

  it("renders the modal footer content", () => {
    render(
      <Modal isOpen>
        <ModalFooter>
          <span>Footer Content</span>
        </ModalFooter>
      </Modal>
    )
    expect(screen.getByText("Footer Content")).toBeVisible()
  })

  it("renders a ModalButton with the provided label", () => {
    render(<ModalButton kind={BaseButtonKind.SECONDARY}>Confirm</ModalButton>)
    expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible()
  })

  it("applies the width prop as an explicit CSS width, overriding the size prop", () => {
    render(
      <Modal isOpen size="default" width="80vw">
        <ModalBody>content</ModalBody>
      </Modal>
    )
    // React Aria portals the dialog into document.body, so query from document.
    const panel = document.querySelector("[role='dialog']")?.parentElement
    expect(panel).toHaveStyle({ width: "80vw" })
  })
})
