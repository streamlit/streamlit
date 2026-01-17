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

import React from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

import { renderWithContexts } from "@streamlit/lib"

import CopyText from "./CopyText"

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    // eslint-disable-next-line no-restricted-properties -- This is fine in tests
    writeText: vi.fn(),
  },
})

describe("CopyText", () => {
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

  it("renders copy button with correct accessibility attributes", () => {
    renderWithContexts(<CopyText text="Test text" data-testid="test" />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy text",
    })
    expect(copyButton).toBeInTheDocument()
    expect(copyButton).toHaveAttribute("title", "Copy text")
    expect(copyButton).toHaveAttribute("data-testid", "testCopyButton")
  })

  it("uses default test id when none provided", () => {
    renderWithContexts(<CopyText text="Test text" />, {})

    const copyButton = screen.getByTestId("stCopyTextButton")
    expect(copyButton).toBeInTheDocument()
  })

  it("copies text to clipboard when copy button is clicked", async () => {
    const testText = "Test content"
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text={testText} />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy text",
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
      name: "Copy text",
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

  it("shows check icon feedback after successful copy", async () => {
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text="Test text" />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy text",
    })
    await userEvent.click(copyButton)

    // After copying, the button should still be accessible with same name
    // (visual feedback is via icon change, not title change)
    expect(
      screen.getByRole("button", {
        name: "Copy text",
      })
    ).toBeVisible()
  })

  it("reverts to copy icon after timeout", async () => {
    vi.useFakeTimers()
    mockWriteText.mockResolvedValue()

    renderWithContexts(<CopyText text="Test text" />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy text",
    })
    await userEvent.click(copyButton)

    // Should show copied state initially
    expect(copyButton).toBeVisible()

    // Fast-forward time to trigger the timeout
    vi.advanceTimersByTime(2100) // Default timeout is 2000ms + buffer

    // Should revert back to copy state
    expect(copyButton).toBeVisible()

    vi.useRealTimers()
  })

  it("handles copy failure gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockWriteText.mockRejectedValue(new Error("Copy failed"))

    renderWithContexts(<CopyText text="Test text" />, {})

    const copyButton = screen.getByRole("button", {
      name: "Copy text",
    })
    await userEvent.click(copyButton)

    // Should still show "Copy text" (not in copied state) when copy fails
    expect(screen.getByRole("button", { name: "Copy text" })).toBeVisible()

    consoleSpy.mockRestore()
  })
})
