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

import { screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Field, Int64 } from "apache-arrow"

import { NumberColumn } from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { render } from "~lib/test_util"

import ColumnMenu, { ColumnMenuProps } from "./ColumnMenu"

/**
 * Renders ColumnMenu and waits for the popover to fully mount.
 * Baseui's Popover performs internal async state updates (focus/positioning),
 * which can cause act() warnings if not awaited.
 */
async function renderAndWaitForPopover(
  ui: ReactElement
): Promise<ReturnType<typeof render>> {
  const result = render(ui)
  await waitFor(() => {
    expect(screen.queryByTestId("stDataFrameColumnMenu")).toBeInTheDocument()
  })
  return result
}

describe("DataFrame ColumnMenu", () => {
  // Mock navigator.clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(),
    },
  })

  const defaultProps: ColumnMenuProps = {
    top: 100,
    left: 100,
    isColumnPinned: false,
    column: NumberColumn({
      title: "testColumn",
      id: "col-1",
      indexNumber: 0,
      isEditable: true,
      name: "testColumn",
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("int_column", new Int64(), true),
        pandasType: {
          field_name: "int_column",
          name: "int_column",
          pandas_type: "int64",
          numpy_type: "int64",
          metadata: null,
        },
      },
      isHidden: false,
      isIndex: false,
      isPinned: false,
      isStretched: false,
    }),
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

  it("renders the column menu at the correct position", async () => {
    await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

    const menu = screen.getByTestId("stDataFrameColumnMenu")
    expect(menu).toBeInTheDocument()

    const menuTarget = screen.getByTestId("stDataFrameColumnMenuTarget")
    expect(menuTarget).toBeInTheDocument()
    expect(menuTarget).toHaveStyle("position: fixed")
    expect(menuTarget).toHaveStyle("top: 100px")
    expect(menuTarget).toHaveStyle("left: 100px")
  })

  it("renders the column menu with the correct column name", async () => {
    await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

    const columnName = screen.getByText("testColumn")
    expect(columnName).toBeVisible()
  })

  it("renders sort options", async () => {
    await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

    expect(screen.getByText("Sort ascending")).toBeInTheDocument()
    expect(screen.getByText("Sort descending")).toBeInTheDocument()
  })

  it("calls sortColumn with 'asc' when clicking sort ascending", async () => {
    await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

    await userEvent.click(screen.getByText("Sort ascending"))
    expect(defaultProps.onSortColumn).toHaveBeenCalledWith("asc")
    expect(defaultProps.onCloseMenu).toHaveBeenCalled()
  })

  it("calls sortColumn with 'desc' when clicking sort descending", async () => {
    await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

    await userEvent.click(screen.getByText("Sort descending"))
    expect(defaultProps.onSortColumn).toHaveBeenCalledWith("desc")
    expect(defaultProps.onCloseMenu).toHaveBeenCalled()
  })

  it("should not render sort options when sortColumn is undefined", async () => {
    await renderAndWaitForPopover(
      <ColumnMenu {...defaultProps} onSortColumn={undefined} />
    )

    // Verify sort options are not present
    expect(screen.queryByText("Sort ascending")).not.toBeInTheDocument()
    expect(screen.queryByText("Sort descending")).not.toBeInTheDocument()
  })

  it("should render sort options when sortColumn is defined", async () => {
    await renderAndWaitForPopover(
      <ColumnMenu {...defaultProps} onSortColumn={() => {}} />
    )

    // Verify sort options are present
    expect(screen.getByText("Sort ascending")).toBeInTheDocument()
    expect(screen.getByText("Sort descending")).toBeInTheDocument()
  })

  describe("pin/unpin functionality", () => {
    it("renders 'Pin column' when column is not pinned", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} isColumnPinned={false} />
      )

      expect(screen.getByText("Pin column")).toBeInTheDocument()
      expect(screen.queryByText("Unpin column")).not.toBeInTheDocument()
    })

    it("renders 'Unpin column' when column is pinned", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} isColumnPinned={true} />
      )

      expect(screen.getByText("Unpin column")).toBeInTheDocument()
      expect(screen.queryByText("Pin column")).not.toBeInTheDocument()
    })

    it("calls pinColumn when clicking 'Pin column'", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} isColumnPinned={false} />
      )

      await userEvent.click(screen.getByText("Pin column"))
      expect(defaultProps.onPinColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })

    it("calls unpinColumn when clicking 'Unpin column'", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} isColumnPinned={true} />
      )

      await userEvent.click(screen.getByText("Unpin column"))
      expect(defaultProps.onUnpinColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })

  describe("format menu functionality", () => {
    it("renders format option when onChangeFormat is provided", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} onChangeFormat={() => {}} />
      )

      expect(screen.getByText("Format")).toBeInTheDocument()
    })

    it("does not render format option when onChangeFormat is undefined", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} onChangeFormat={undefined} />
      )

      expect(screen.queryByText("Format")).not.toBeInTheDocument()
    })
  })

  describe("autosize functionality", () => {
    it("renders 'Autosize' when onAutosize is defined", async () => {
      await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

      expect(screen.getByText("Autosize")).toBeInTheDocument()
    })

    it("does not render 'Autosize' when onAutosize is undefined", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} onAutosize={undefined} />
      )

      expect(screen.queryByText("Autosize")).not.toBeInTheDocument()
    })

    it("calls onAutosize when clicking 'Autosize'", async () => {
      await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

      await userEvent.click(screen.getByText("Autosize"))
      expect(defaultProps.onAutosize).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })

  describe("hide column functionality", () => {
    it("renders 'Hide column' when onHideColumn is provided", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} onHideColumn={() => {}} />
      )

      expect(screen.getByText("Hide column")).toBeInTheDocument()
    })

    it("does not render 'Hide column' when onHideColumn is undefined", async () => {
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} onHideColumn={undefined} />
      )

      expect(screen.queryByText("Hide column")).not.toBeInTheDocument()
    })

    it("calls onHideColumn when clicking 'Hide column'", async () => {
      const onHideColumn = vi.fn()
      await renderAndWaitForPopover(
        <ColumnMenu {...defaultProps} onHideColumn={onHideColumn} />
      )

      await userEvent.click(screen.getByText("Hide column"))
      expect(onHideColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })

  describe("copy column name functionality (isCopied state)", () => {
    // eslint-disable-next-line no-restricted-properties -- This is fine in tests
    const mockWriteText = vi.mocked(navigator.clipboard.writeText)

    it("shows copy icon initially and switches to check icon after copy", async () => {
      mockWriteText.mockResolvedValue()

      await renderAndWaitForPopover(<ColumnMenu {...defaultProps} />)

      const copyButton = screen.getByRole("button", {
        name: "Copy column name",
      })

      // Initially shows the material copy icon inside the copy button
      expect(
        within(copyButton).getByTestId("stIconMaterial")
      ).toHaveTextContent("content_copy")

      await userEvent.click(copyButton)

      expect(mockWriteText).toHaveBeenCalledWith("testColumn")

      // After successful copy, the icon should switch to a check mark
      await waitFor(() => {
        expect(
          within(copyButton).getByTestId("stIconMaterial")
        ).toHaveTextContent("check")
      })
    })
  })
})
