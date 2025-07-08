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
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

import FormattingMenu, { FormattingMenuProps } from "./FormattingMenu"

describe("DataFrame FormattingMenu", () => {
  const defaultProps: FormattingMenuProps = {
    columnKind: "number",
    isOpen: true,
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    onChangeFormat: vi.fn(),
    onCloseMenu: vi.fn(),
    children: <div>Trigger</div>,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders number format options when columnKind is number", () => {
    render(<FormattingMenu {...defaultProps} />)

    // Check for presence of number-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Dollar")).toBeInTheDocument()
    expect(screen.getByText("Euro")).toBeInTheDocument()
    expect(screen.getByText("Yen")).toBeInTheDocument()
    expect(screen.getByText("Percent")).toBeInTheDocument()
    expect(screen.getByText("Scientific")).toBeInTheDocument()
    expect(screen.getByText("Accounting")).toBeInTheDocument()
  })

  it("renders datetime format options when columnKind is datetime", () => {
    render(<FormattingMenu {...defaultProps} columnKind="datetime" />)

    // Check for presence of datetime-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Localized")).toBeInTheDocument()
    expect(screen.getByText("Distance")).toBeInTheDocument()
    expect(screen.getByText("Calendar")).toBeInTheDocument()

    // Verify number formats are not present
    expect(screen.queryByText("Dollar")).not.toBeInTheDocument()
    expect(screen.queryByText("Scientific")).not.toBeInTheDocument()
  })

  it("renders date format options when columnKind is date", () => {
    render(<FormattingMenu {...defaultProps} columnKind="date" />)

    // Check for presence of date-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Localized")).toBeInTheDocument()
    expect(screen.getByText("Distance")).toBeInTheDocument()

    // Verify datetime-specific format is not present
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument()
  })

  it("renders time format options when columnKind is time", () => {
    render(<FormattingMenu {...defaultProps} columnKind="time" />)

    // Check for presence of time-specific formats
    expect(screen.getByText("Automatic")).toBeInTheDocument()
    expect(screen.getByText("Localized")).toBeInTheDocument()

    // Verify other formats are not present
    expect(screen.queryByText("Distance")).not.toBeInTheDocument()
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument()
  })

  it("renders no format options for unknown column kind", () => {
    render(<FormattingMenu {...defaultProps} columnKind="unknown" />)

    // Menu should be empty for unknown column types
    expect(screen.queryByText("Automatic")).not.toBeInTheDocument()
    expect(screen.queryByText("Localized")).not.toBeInTheDocument()
  })

  it("calls onChangeFormat and onCloseMenu when clicking a format option", async () => {
    render(<FormattingMenu {...defaultProps} />)

    // Click the "Dollar" format option
    await userEvent.click(screen.getByText("Dollar"))

    // Verify callbacks are called with correct arguments
    expect(defaultProps.onChangeFormat).toHaveBeenCalledWith("dollar")
    expect(defaultProps.onCloseMenu).toHaveBeenCalled()
  })

  it("renders children as trigger element", () => {
    const triggerText = "Custom Trigger"
    render(
      <FormattingMenu {...defaultProps}>
        <div>{triggerText}</div>
      </FormattingMenu>
    )

    expect(screen.getByText(triggerText)).toBeInTheDocument()
  })
})
