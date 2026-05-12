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

import type { ReactElement } from "react"

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

import FormattingMenu, { FormattingMenuProps } from "./FormattingMenu"

/**
 * Renders FormattingMenu and waits for the popover to fully mount.
 * Baseui's Popover performs internal async state updates (focus/positioning),
 * which can cause act() warnings if not awaited.
 */
async function renderAndWaitForPopover(
  ui: ReactElement
): Promise<ReturnType<typeof render>> {
  const result = render(ui)
  await waitFor(() => {
    expect(
      screen.queryByTestId("stDataFrameColumnFormattingMenu")
    ).toBeInTheDocument()
  })
  return result
}

describe("DataFrame FormattingMenu", () => {
  const defaultChildren = <div>Trigger</div>

  const defaultProps: Omit<FormattingMenuProps, "children"> = {
    columnKind: "number",
    isOpen: true,
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    onChangeFormat: vi.fn(),
    onCloseMenu: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders number format options when columnKind is number", async () => {
    await renderAndWaitForPopover(
      <FormattingMenu {...defaultProps}>{defaultChildren}</FormattingMenu>
    )

    // Check for presence of number-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Dollar")).toBeInTheDocument()
    expect(screen.getByText("Euro")).toBeInTheDocument()
    expect(screen.getByText("Yen")).toBeInTheDocument()
    expect(screen.getByText("Percent")).toBeInTheDocument()
    expect(screen.getByText("Scientific")).toBeInTheDocument()
    expect(screen.getByText("Accounting")).toBeInTheDocument()
  })

  it("renders datetime format options when columnKind is datetime", async () => {
    await renderAndWaitForPopover(
      <FormattingMenu {...defaultProps} columnKind="datetime">
        {defaultChildren}
      </FormattingMenu>
    )

    // Check for presence of datetime-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Localized")).toBeInTheDocument()
    expect(screen.getByText("Distance")).toBeInTheDocument()
    expect(screen.getByText("Calendar")).toBeInTheDocument()

    // Verify number formats are not present
    expect(screen.queryByText("Dollar")).not.toBeInTheDocument()
    expect(screen.queryByText("Scientific")).not.toBeInTheDocument()
  })

  it("renders date format options when columnKind is date", async () => {
    await renderAndWaitForPopover(
      <FormattingMenu {...defaultProps} columnKind="date">
        {defaultChildren}
      </FormattingMenu>
    )

    // Check for presence of date-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Localized")).toBeInTheDocument()
    expect(screen.getByText("Distance")).toBeInTheDocument()

    // Verify datetime-specific format is not present
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument()
  })

  it("renders time format options when columnKind is time", async () => {
    await renderAndWaitForPopover(
      <FormattingMenu {...defaultProps} columnKind="time">
        {defaultChildren}
      </FormattingMenu>
    )

    // Check for presence of time-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Localized")).toBeInTheDocument()

    // Verify other formats are not present
    expect(screen.queryByText("Distance")).not.toBeInTheDocument()
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument()
  })

  it("renders no format options for unknown column kind", () => {
    // When columnKind is unknown, the component returns an empty fragment
    // and there's no popover to wait for
    render(
      <FormattingMenu {...defaultProps} columnKind="unknown">
        {defaultChildren}
      </FormattingMenu>
    )

    // Menu should be empty for unknown column types
    expect(screen.queryByText("Automatic")).not.toBeInTheDocument()
    expect(screen.queryByText("Localized")).not.toBeInTheDocument()
  })

  it("calls onChangeFormat and onCloseMenu when clicking a format option", async () => {
    await renderAndWaitForPopover(
      <FormattingMenu {...defaultProps}>{defaultChildren}</FormattingMenu>
    )

    // Click the "Dollar" format option
    await userEvent.click(screen.getByText("Dollar"))

    // Verify callbacks are called with correct arguments
    expect(defaultProps.onChangeFormat).toHaveBeenCalledWith("dollar")
    expect(defaultProps.onCloseMenu).toHaveBeenCalled()
  })

  it("renders children as trigger element", async () => {
    const triggerText = "Custom Trigger"
    await renderAndWaitForPopover(
      <FormattingMenu {...defaultProps}>
        <div>{triggerText}</div>
      </FormattingMenu>
    )

    expect(screen.getByText(triggerText)).toBeInTheDocument()
  })
})
