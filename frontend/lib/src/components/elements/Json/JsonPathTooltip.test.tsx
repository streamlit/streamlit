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
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

import JsonPathTooltip, {
  JsonPathTooltipProps,
  OPEN_GUARD_MS,
} from "./JsonPathTooltip"

const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

const getProps = (
  props: Partial<JsonPathTooltipProps> = {}
): JsonPathTooltipProps => ({
  top: 100,
  left: 200,
  path: "data.items[0].name",
  clearTooltip: vi.fn(),
  ...props,
})

describe("JsonPathTooltip", () => {
  beforeEach(() => {
    mockWriteText.mockReset()
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the path text", () => {
    render(<JsonPathTooltip {...getProps()} />)
    expect(screen.getByText("data.items[0].name")).toBeVisible()
  })

  it("renders the tooltip container with correct test id", () => {
    render(<JsonPathTooltip {...getProps()} />)
    expect(screen.getByTestId("stJsonPathTooltip")).toBeVisible()
  })

  it("renders a copy button", () => {
    render(<JsonPathTooltip {...getProps()} />)
    expect(screen.getByRole("button", { name: /copy/i })).toBeVisible()
  })

  it("copies the path to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup()
    render(<JsonPathTooltip {...getProps()} />)

    const copyButton = screen.getByRole("button", { name: /copy/i })
    await user.click(copyButton)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied/i })).toBeVisible()
    })
  })

  it("calls clearTooltip when Escape is pressed", async () => {
    const user = userEvent.setup()
    const clearTooltip = vi.fn()
    render(<JsonPathTooltip {...getProps({ clearTooltip })} />)

    await user.keyboard("{Escape}")

    expect(clearTooltip).toHaveBeenCalledTimes(1)
  })

  it("calls clearTooltip when clicking outside the tooltip", async () => {
    const user = userEvent.setup()
    const clearTooltip = vi.fn()
    render(
      <div>
        <JsonPathTooltip {...getProps({ clearTooltip })} />
        <button type="button">outside</button>
      </div>
    )

    // Advance Date.now() past the timestamp guard without a real timeout,
    // avoiding floating-ui flushSync updates outside act().
    const originalNow = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(originalNow + OPEN_GUARD_MS + 1)
    await user.click(screen.getByRole("button", { name: "outside" }))

    expect(clearTooltip).toHaveBeenCalledTimes(1)
  })

  it("does not call clearTooltip when clicking inside the tooltip", async () => {
    const user = userEvent.setup()
    const clearTooltip = vi.fn()
    render(<JsonPathTooltip {...getProps({ clearTooltip })} />)

    // Advance Date.now() past the timestamp guard.
    const originalNow = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(originalNow + OPEN_GUARD_MS + 1)
    await user.click(screen.getByRole("button", { name: /copy/i }))

    expect(clearTooltip).not.toHaveBeenCalled()
  })
})
