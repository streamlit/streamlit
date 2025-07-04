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

import ColumnMenu, { ColumnMenuProps } from "./ColumnMenu"

describe("DataFrame ColumnMenu", () => {
  const defaultProps: ColumnMenuProps = {
    top: 100,
    left: 100,
    isColumnPinned: false,
    columnKind: "number",
    onPinColumn: vi.fn(),
    onUnpinColumn: vi.fn(),
    onCloseMenu: vi.fn(),
    onSortColumn: vi.fn(),
    onChangeFormat: vi.fn(),
    onAutosize: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("renders the column menu at the correct position", () => {
    render(<ColumnMenu {...defaultProps} />)

    const menu = screen.getByTestId("stDataFrameColumnMenu")
    expect(menu).toBeInTheDocument()

    const menuTarget = screen.getByTestId("stDataFrameColumnMenuTarget")
    expect(menuTarget).toBeInTheDocument()
    expect(menuTarget).toHaveStyle("position: fixed")
    expect(menuTarget).toHaveStyle("top: 100px")
    expect(menuTarget).toHaveStyle("left: 100px")
  })

  test("renders sort options", () => {
    render(<ColumnMenu {...defaultProps} />)

    expect(screen.getByText("Sort ascending")).toBeInTheDocument()
    expect(screen.getByText("Sort descending")).toBeInTheDocument()
  })

  test("calls sortColumn with 'asc' when clicking sort ascending", async () => {
    render(<ColumnMenu {...defaultProps} />)

    await userEvent.click(screen.getByText("Sort ascending"))
    expect(defaultProps.onSortColumn).toHaveBeenCalledWith("asc")
    expect(defaultProps.onCloseMenu).toHaveBeenCalled()
  })

  test("calls sortColumn with 'desc' when clicking sort descending", async () => {
    render(<ColumnMenu {...defaultProps} />)

    await userEvent.click(screen.getByText("Sort descending"))
    expect(defaultProps.onSortColumn).toHaveBeenCalledWith("desc")
    expect(defaultProps.onCloseMenu).toHaveBeenCalled()
  })

  it("should not render sort options when sortColumn is undefined", () => {
    render(<ColumnMenu {...defaultProps} onSortColumn={undefined} />)

    // Verify sort options are not present
    expect(screen.queryByText("Sort ascending")).not.toBeInTheDocument()
    expect(screen.queryByText("Sort descending")).not.toBeInTheDocument()
  })

  it("should render sort options when sortColumn is defined", () => {
    render(<ColumnMenu {...defaultProps} onSortColumn={() => {}} />)

    // Verify sort options are present
    expect(screen.getByText("Sort ascending")).toBeInTheDocument()
    expect(screen.getByText("Sort descending")).toBeInTheDocument()
  })

  describe("pin/unpin functionality", () => {
    test("renders 'Pin column' when column is not pinned", () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={false} />)

      expect(screen.getByText("Pin column")).toBeInTheDocument()
      expect(screen.queryByText("Unpin column")).not.toBeInTheDocument()
    })

    test("renders 'Unpin column' when column is pinned", () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={true} />)

      expect(screen.getByText("Unpin column")).toBeInTheDocument()
      expect(screen.queryByText("Pin column")).not.toBeInTheDocument()
    })

    test("calls pinColumn when clicking 'Pin column'", async () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={false} />)

      await userEvent.click(screen.getByText("Pin column"))
      expect(defaultProps.onPinColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })

    test("calls unpinColumn when clicking 'Unpin column'", async () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={true} />)

      await userEvent.click(screen.getByText("Unpin column"))
      expect(defaultProps.onUnpinColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })

  describe("format menu functionality", () => {
    test("renders format option when onChangeFormat is provided", () => {
      render(<ColumnMenu {...defaultProps} onChangeFormat={() => {}} />)

      expect(screen.getByText("Format")).toBeInTheDocument()
    })

    test("does not render format option when onChangeFormat is undefined", () => {
      render(<ColumnMenu {...defaultProps} onChangeFormat={undefined} />)

      expect(screen.queryByText("Format")).not.toBeInTheDocument()
    })
  })

  describe("autosize functionality", () => {
    test("renders 'Autosize' when onAutosize is defined", () => {
      render(<ColumnMenu {...defaultProps} />)

      expect(screen.getByText("Autosize")).toBeInTheDocument()
    })

    test("does not render 'Autosize' when onAutosize is undefined", () => {
      render(<ColumnMenu {...defaultProps} onAutosize={undefined} />)

      expect(screen.queryByText("Autosize")).not.toBeInTheDocument()
    })

    test("calls onAutosize when clicking 'Autosize'", async () => {
      render(<ColumnMenu {...defaultProps} />)

      await userEvent.click(screen.getByText("Autosize"))
      expect(defaultProps.onAutosize).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })

  describe("hide column functionality", () => {
    test("renders 'Hide column' when onHideColumn is provided", () => {
      render(<ColumnMenu {...defaultProps} onHideColumn={() => {}} />)

      expect(screen.getByText("Hide column")).toBeInTheDocument()
    })

    test("does not render 'Hide column' when onHideColumn is undefined", () => {
      render(<ColumnMenu {...defaultProps} onHideColumn={undefined} />)

      expect(screen.queryByText("Hide column")).not.toBeInTheDocument()
    })

    test("calls onHideColumn when clicking 'Hide column'", async () => {
      const onHideColumn = vi.fn()
      render(<ColumnMenu {...defaultProps} onHideColumn={onHideColumn} />)

      await userEvent.click(screen.getByText("Hide column"))
      expect(onHideColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })
})
