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
import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

import { Block as BlockProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Dialog, { Props as DialogProps } from "./Dialog"

const getProps = (
  elementProps: Partial<BlockProto.Dialog> = {},
  props: Partial<DialogProps> = {}
): DialogProps => ({
  element: BlockProto.Dialog.create({
    title: "StreamlitDialog",
    isOpen: true,
    dismissible: true,
    ...elementProps,
  }),
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  fragmentId: undefined,
  ...props,
})

describe("Dialog container", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(
      <Dialog {...props}>
        <div>test</div>
      </Dialog>
    )

    const dialogContainer = screen.getByTestId("stDialog")
    expect(dialogContainer).toBeInTheDocument()
    expect(dialogContainer).toHaveClass("stDialog")
  })

  it("should render the text when open", () => {
    const props = getProps()
    render(
      <Dialog {...props}>
        <div>test</div>
      </Dialog>
    )

    expect(screen.getByText("test")).toBeVisible()
  })

  it("should not render the text when closed", () => {
    const props = getProps({ isOpen: false })
    render(
      <Dialog {...props}>
        <div>test</div>
      </Dialog>
    )

    expect(() => screen.getByText("test")).toThrow()
  })

  it("renders an icon when provided", () => {
    const props = getProps({ icon: "🎉" })
    render(
      <Dialog {...props}>
        <div>test</div>
      </Dialog>
    )

    const icon = screen.getByTestId("stDialogIcon")
    expect(icon).toBeVisible()
    expect(icon).toHaveTextContent("🎉")
  })

  it("does not render an icon when not provided", () => {
    const props = getProps()
    render(
      <Dialog {...props}>
        <div>test</div>
      </Dialog>
    )

    expect(screen.queryByTestId("stDialogIcon")).not.toBeInTheDocument()
  })

  it("should close when dismissible", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(
      <Dialog {...props}>
        <div>test</div>
      </Dialog>
    )

    expect(screen.getByText("test")).toBeVisible()
    await user.click(screen.getByLabelText("Close"))
    // dialog should be closed by clicking outside and, thus, the content should be gone
    expect(() => screen.getByText("test")).toThrow()
  })

  it("should not close when not dismissible", () => {
    const props = getProps({ dismissible: false })
    render(
      <Dialog {...props}>
        <div>test</div>
      </Dialog>
    )

    expect(screen.getByText("test")).toBeVisible()
    // close button - and hence dismiss - does not exist
    expect(() => screen.getByLabelText("Close")).toThrow()
  })

  it("should handle modal close events when dismissible", async () => {
    const user = userEvent.setup()
    const props = getProps({ dismissible: true })
    render(
      <Dialog {...props}>
        <div>test content</div>
      </Dialog>
    )

    expect(screen.getByText("test content")).toBeVisible()

    // Click the close button to trigger onClose
    const closeButton = screen.getByLabelText("Close")
    await user.click(closeButton)

    // Dialog should be closed (content no longer visible)
    expect(() => screen.getByText("test content")).toThrow()
  })

  describe("on_dismiss functionality", () => {
    it("does not trigger rerun when id is not set", async () => {
      const user = userEvent.setup()
      const mockWidgetMgr = {
        setTriggerValue: vi.fn(),
      }

      const props = getProps(
        {
          id: "", // No id means on_dismiss="ignore"
          dismissible: true,
        },
        {
          widgetMgr: mockWidgetMgr as unknown as WidgetStateManager,
        }
      )

      render(
        <Dialog {...props}>
          <div>test content</div>
        </Dialog>
      )

      // Simulate dismiss action
      const closeButton = screen.getByLabelText("Close")
      await user.click(closeButton)

      expect(mockWidgetMgr.setTriggerValue).not.toHaveBeenCalled()
    })

    it("triggers rerun when id is set", async () => {
      const user = userEvent.setup()
      const mockWidgetMgr = {
        setTriggerValue: vi.fn().mockResolvedValue(undefined),
      }

      const props = getProps(
        {
          id: "test-dialog-id", // id present means on_dismiss is activated
          dismissible: true,
        },
        {
          widgetMgr: mockWidgetMgr as unknown as WidgetStateManager,
          fragmentId: "test-fragment-id",
        }
      )

      render(
        <Dialog {...props}>
          <div>test content</div>
        </Dialog>
      )

      // Simulate dismiss action
      const closeButton = screen.getByLabelText("Close")
      await user.click(closeButton)

      expect(mockWidgetMgr.setTriggerValue).toHaveBeenCalledWith(
        { id: "test-dialog-id", formId: "" },
        { fromUi: true },
        "test-fragment-id"
      )
    })

    it("triggers rerun without fragmentId when not provided", async () => {
      const user = userEvent.setup()
      const mockWidgetMgr = {
        setTriggerValue: vi.fn().mockResolvedValue(undefined),
      }

      const props = getProps(
        {
          id: "test-dialog-id",
          dismissible: true,
        },
        {
          widgetMgr: mockWidgetMgr as unknown as WidgetStateManager,
          // fragmentId not provided
        }
      )

      render(
        <Dialog {...props}>
          <div>test content</div>
        </Dialog>
      )

      // Simulate dismiss action
      const closeButton = screen.getByLabelText("Close")
      await user.click(closeButton)

      expect(mockWidgetMgr.setTriggerValue).toHaveBeenCalledWith(
        { id: "test-dialog-id", formId: "" },
        { fromUi: true },
        undefined
      )
    })

    it("does not trigger rerun when dialog is non-dismissible", () => {
      const mockWidgetMgr = {
        setTriggerValue: vi.fn(),
      }

      const props = getProps(
        {
          id: "test-dialog-id",
          dismissible: false, // Non-dismissible dialog
        },
        {
          widgetMgr: mockWidgetMgr as unknown as WidgetStateManager,
        }
      )

      render(
        <Dialog {...props}>
          <div>test content</div>
        </Dialog>
      )

      // No close button should exist, so no way to trigger dismiss event
      expect(() => screen.getByLabelText("Close")).toThrow()
      expect(mockWidgetMgr.setTriggerValue).not.toHaveBeenCalled()
    })
  })

  describe("dialog width", () => {
    // The mapDialogWidthToModalSize function is tested implicitly here.
    // The Modal component's calculateModalSize is tested separately in Modal.test.tsx.
    // Here we verify that different width props render the dialog correctly.
    it.each([
      { width: BlockProto.Dialog.DialogWidth.SMALL, expectedSize: "default" },
      { width: BlockProto.Dialog.DialogWidth.MEDIUM, expectedSize: "medium" },
      { width: BlockProto.Dialog.DialogWidth.LARGE, expectedSize: "large" },
    ])(
      "renders dialog with $expectedSize size when width is $width",
      ({ width }) => {
        const props = getProps({ width })
        render(
          <Dialog {...props}>
            <div>test</div>
          </Dialog>
        )

        // Verify the dialog renders successfully with the given width prop
        const modal = screen.getByRole("dialog")
        expect(modal).toBeVisible()

        // Verify dialog content is rendered
        expect(screen.getByText("test")).toBeVisible()
      }
    )
  })

  describe("keyboard handling", () => {
    it("prevents R key from triggering rerun when dialog is non-dismissible", () => {
      const props = getProps({ dismissible: false })

      render(
        <Dialog {...props}>
          <div>test content</div>
        </Dialog>
      )

      // Dispatch a keyboard event for 'r' key
      // The Dialog component should prevent this from propagating
      const event = new KeyboardEvent("keydown", {
        key: "r",
        bubbles: true,
        cancelable: true,
      })

      // Dispatch the event on document (where the Dialog's listener is attached)
      const wasDefaultPrevented = !document.dispatchEvent(event)

      // Verify the event was prevented by the Dialog's handler
      expect(wasDefaultPrevented).toBe(true)

      // Dialog should still be open
      expect(screen.getByText("test content")).toBeVisible()
    })

    it("does not prevent R key when dialog is dismissible", () => {
      const props = getProps({ dismissible: true })

      render(
        <Dialog {...props}>
          <div>test content</div>
        </Dialog>
      )

      // Dispatch a keyboard event for 'r' key
      const event = new KeyboardEvent("keydown", {
        key: "r",
        bubbles: true,
        cancelable: true,
      })

      const wasDefaultPrevented = !document.dispatchEvent(event)

      // For dismissible dialogs, the R key should NOT be prevented
      expect(wasDefaultPrevented).toBe(false)
    })

    it("allows typing in input fields within non-dismissible dialogs", async () => {
      const user = userEvent.setup()
      const props = getProps({ dismissible: false })
      render(
        <Dialog {...props}>
          <input type="text" aria-label="Test input" />
        </Dialog>
      )

      const input = screen.getByLabelText("Test input")
      await user.click(input)
      await user.type(input, "test")

      expect(input).toHaveValue("test")
    })
  })
})
