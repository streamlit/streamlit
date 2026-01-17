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

import { renderWithContexts } from "@streamlit/lib/testing"

import CopyText from "./CopyText"

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
})

describe("CopyText", () => {
  // eslint-disable-next-line no-restricted-properties -- This is fine in tests
  const mockWriteText = vi.mocked(navigator.clipboard.writeText)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders text correctly with isCaption=false", () => {
    renderWithContexts(<CopyText text="Hello World" isCaption={false} />, {})

    expect(screen.getByText("Hello World")).toBeVisible()
  })

  it("renders text correctly with isCaption=true", () => {
    renderWithContexts(<CopyText text="Caption text" isCaption={true} />, {})

    expect(screen.getByText("Caption text")).toBeVisible()
  })

  it("renders container with correct accessibility attributes", () => {
    renderWithContexts(<CopyText text="Test text" data-testid="test" />, {})

    // Container has role="button" and is the primary interactive element
    const container = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    expect(container).toBeVisible()
    expect(container).toHaveAttribute("aria-label", "Copy to clipboard")
    expect(container).toHaveAttribute("tabIndex", "0")
    expect(container).toHaveAttribute("data-testid", "test")

    // Inner button is hidden from accessibility tree but visible for mouse users
    const iconButton = screen.getByTestId("testCopyButton")
    expect(iconButton).toBeVisible()
    expect(iconButton).toHaveAttribute("aria-hidden", "true")
    expect(iconButton).toHaveAttribute("tabIndex", "-1")
  })

  it("uses default test id when none provided", () => {
    renderWithContexts(<CopyText text="Test text" />, {})

    const iconButton = screen.getByTestId("stCopyTextButton")
    expect(iconButton).toBeVisible()
  })

  it("copies text to clipboard when copy button is clicked", async () => {
    const testText = "Test content"
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text={testText} />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    expect(mockWriteText).toHaveBeenCalledWith(testText)
  })

  it("copies different text when copyText prop is provided", async () => {
    mockWriteText.mockResolvedValue()

    renderWithContexts(
      <CopyText text="Display text" copyText="Copy this instead" />,
      {}
    )

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    expect(mockWriteText).toHaveBeenCalledWith("Copy this instead")
  })

  it("copies text when clicking anywhere on the container", async () => {
    const testText = "Container text"
    mockWriteText.mockResolvedValue()

    renderWithContexts(
      <CopyText text={testText} data-testid="container" />,
      {}
    )

    const container = screen.getByTestId("container")
    await userEvent.click(container)

    expect(mockWriteText).toHaveBeenCalledWith(testText)
  })

  it("copies text when pressing Enter on the container", async () => {
    const testText = "Keyboard test"
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text={testText} />, {})

    const container = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    container.focus()
    await userEvent.keyboard("{Enter}")

    expect(mockWriteText).toHaveBeenCalledWith(testText)
  })

  it("copies text when pressing Space on the container", async () => {
    const testText = "Keyboard test"
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text={testText} />, {})

    const container = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    container.focus()
    await userEvent.keyboard(" ")

    expect(mockWriteText).toHaveBeenCalledWith(testText)
  })

  it("shows check icon feedback after successful copy", async () => {
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text="Test text" />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    // After copying, the button label changes to "Copied" for accessibility feedback
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible()
  })

  it("reverts to copy icon after timeout", async () => {
    vi.useFakeTimers()
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text="Test text" />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    // Should show copied state initially
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible()

    // Fast-forward time to trigger the timeout
    vi.advanceTimersByTime(2100) // Default timeout is 2000ms + buffer

    // Should revert back to copy state
    expect(
      screen.getByRole("button", { name: "Copy to clipboard" })
    ).toBeVisible()

    vi.useRealTimers()
  })

  it("handles copy failure gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockWriteText.mockRejectedValue(new Error("Copy failed"))

    renderWithContexts(<CopyText text="Test text" />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    // Should still show "Copy to clipboard" (not in copied state) when copy fails
    expect(
      screen.getByRole("button", { name: "Copy to clipboard" })
    ).toBeVisible()

    consoleSpy.mockRestore()
  })
})
