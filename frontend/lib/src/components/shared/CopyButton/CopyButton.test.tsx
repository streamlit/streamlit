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

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { render } from "~lib/test_util"

import CopyButton from "./CopyButton"

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
})

describe("CopyButton", () => {
  // eslint-disable-next-line no-restricted-properties -- This is fine in tests
  const mockWriteText = vi.mocked(navigator.clipboard.writeText)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders a button with copy icon and correct accessibility attributes", () => {
    render(<CopyButton text="test code" data-testid="stCodeCopyButton" />)

    const button = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    expect(button).toBeVisible()
    expect(button).toHaveAttribute("title", "Copy to clipboard")
    expect(button).toHaveAttribute("data-copy-state", "idle")

    expect(screen.getByTestId("stCodeCopyButton")).toBeVisible()
  })

  it("copies text to clipboard when clicked", async () => {
    const testText = "console.log('Hello World')"
    mockWriteText.mockResolvedValue()

    render(<CopyButton text={testText} />)

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    expect(mockWriteText).toHaveBeenCalledWith(testText)
  })

  it("shows check icon temporarily after successful copy", async () => {
    mockWriteText.mockResolvedValue()

    render(<CopyButton text="test" />)

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    expect(copyButton).toBeVisible()
    expect(mockWriteText).toHaveBeenCalledWith("test")
    expect(copyButton).toHaveAttribute("data-copy-state", "copied")
  })

  it("reverts to copy icon after timeout", async () => {
    mockWriteText.mockResolvedValue()

    render(<CopyButton text="test" />)

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })
    await userEvent.click(copyButton)

    expect(mockWriteText).toHaveBeenCalledWith("test")

    await waitFor(
      () => {
        expect(copyButton).toBeVisible()
      },
      { timeout: 3000 }
    )
  })

  it("handles copy failure gracefully", async () => {
    mockWriteText.mockRejectedValue(new Error("Copy failed"))

    render(<CopyButton text="test" />)

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })

    await userEvent.click(copyButton)

    expect(mockWriteText).toHaveBeenCalledWith("test")
    expect(copyButton).toBeVisible()
  })

  it("can be clicked multiple times", async () => {
    mockWriteText.mockResolvedValue()

    render(<CopyButton text="test code" />)

    const copyButton = screen.getByRole("button", {
      name: "Copy to clipboard",
    })

    await userEvent.click(copyButton)
    await userEvent.click(copyButton)
    await userEvent.click(copyButton)

    expect(mockWriteText).toHaveBeenCalledTimes(3)
    expect(mockWriteText).toHaveBeenCalledWith("test code")
  })
})
