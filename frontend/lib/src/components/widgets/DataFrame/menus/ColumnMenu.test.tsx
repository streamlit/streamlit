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

import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Field, Int64, Utf8 } from "apache-arrow"

import {
  NumberColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { TEN_BY_TEN } from "~lib/mocks/arrow/tenByTen"
import { render } from "~lib/test_util"

import ColumnMenu, { ColumnMenuProps } from "./ColumnMenu"

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

  it("renders the column menu at the correct position", () => {
    render(<ColumnMenu {...defaultProps} />)

    const menu = screen.getByTestId("stDataFrameColumnMenu")
    expect(menu).toBeInTheDocument()

    const menuTarget = screen.getByTestId("stDataFrameColumnMenuTarget")
    expect(menuTarget).toBeInTheDocument()
    expect(menuTarget).toHaveStyle("position: fixed")
    expect(menuTarget).toHaveStyle("top: 100px")
    expect(menuTarget).toHaveStyle("left: 100px")
  })

  it("renders the column menu with the correct column name", () => {
    render(<ColumnMenu {...defaultProps} />)

    const columnName = screen.getByText("testColumn")
    expect(columnName).toBeVisible()
  })

  it("renders sort options", () => {
    render(<ColumnMenu {...defaultProps} />)

    expect(screen.getByText("Sort ascending")).toBeInTheDocument()
    expect(screen.getByText("Sort descending")).toBeInTheDocument()
  })

  it("calls sortColumn with 'asc' when clicking sort ascending", async () => {
    render(<ColumnMenu {...defaultProps} />)

    await userEvent.click(screen.getByText("Sort ascending"))
    expect(defaultProps.onSortColumn).toHaveBeenCalledWith("asc")
    expect(defaultProps.onCloseMenu).toHaveBeenCalled()
  })

  it("calls sortColumn with 'desc' when clicking sort descending", async () => {
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
    it("renders 'Pin column' when column is not pinned", () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={false} />)

      expect(screen.getByText("Pin column")).toBeInTheDocument()
      expect(screen.queryByText("Unpin column")).not.toBeInTheDocument()
    })

    it("renders 'Unpin column' when column is pinned", () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={true} />)

      expect(screen.getByText("Unpin column")).toBeInTheDocument()
      expect(screen.queryByText("Pin column")).not.toBeInTheDocument()
    })

    it("calls pinColumn when clicking 'Pin column'", async () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={false} />)

      await userEvent.click(screen.getByText("Pin column"))
      expect(defaultProps.onPinColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })

    it("calls unpinColumn when clicking 'Unpin column'", async () => {
      render(<ColumnMenu {...defaultProps} isColumnPinned={true} />)

      await userEvent.click(screen.getByText("Unpin column"))
      expect(defaultProps.onUnpinColumn).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })

  describe("format menu functionality", () => {
    it("renders format option when onChangeFormat is provided", () => {
      render(<ColumnMenu {...defaultProps} onChangeFormat={() => {}} />)

      expect(screen.getByText("Format")).toBeInTheDocument()
    })

    it("does not render format option when onChangeFormat is undefined", () => {
      render(<ColumnMenu {...defaultProps} onChangeFormat={undefined} />)

      expect(screen.queryByText("Format")).not.toBeInTheDocument()
    })

    it("does not close format sub-menu on blur while pointer is down", () => {
      render(<ColumnMenu {...defaultProps} />)

      const formatMenuItem = screen.getByRole("menuitem", {
        name: /Format/,
      })

      // Focus the Format item to open the sub-menu
      fireEvent.focus(formatMenuItem)
      expect(formatMenuItem).toHaveAttribute("aria-expanded", "true")

      // Dispatch pointerdown on document to set the pointerDownRef flag.
      // We use fireEvent here (not userEvent) because we're testing the
      // document-level capture listener, not simulating a user click on a UI
      // element. userEvent.pointer corrupts JSDOM's clipboard mock state.
      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.pointerDown(document.body)

      // Blur the Format item while pointer is still down
      fireEvent.blur(formatMenuItem)

      // Sub-menu should remain open because pointer is down
      expect(formatMenuItem).toHaveAttribute("aria-expanded", "true")

      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.pointerUp(document.body)
    })

    it("closes format sub-menu on keyboard-driven blur", () => {
      render(<ColumnMenu {...defaultProps} />)

      const formatMenuItem = screen.getByRole("menuitem", {
        name: /Format/,
      })

      // Focus to open
      fireEvent.focus(formatMenuItem)
      expect(formatMenuItem).toHaveAttribute("aria-expanded", "true")

      // Blur without pointer down (simulates Tab away)
      fireEvent.blur(formatMenuItem)

      // Sub-menu should close
      expect(formatMenuItem).toHaveAttribute("aria-expanded", "false")
    })
  })

  describe("dismiss behavior", () => {
    it("calls onCloseMenu when Escape is pressed", async () => {
      render(<ColumnMenu {...defaultProps} />)

      await userEvent.keyboard("{Escape}")
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })

    it("calls onCloseMenu when clicking outside the menu", async () => {
      render(<ColumnMenu {...defaultProps} />)

      await userEvent.click(document.body)
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })

    it("does not call onCloseMenu when clicking inside the menu", async () => {
      render(<ColumnMenu {...defaultProps} />)

      const menu = screen.getByTestId("stDataFrameColumnMenu")
      await userEvent.click(menu)
      expect(defaultProps.onCloseMenu).not.toHaveBeenCalled()
    })
  })

  describe("autosize functionality", () => {
    it("renders 'Autosize' when onAutosize is defined", () => {
      render(<ColumnMenu {...defaultProps} />)

      expect(screen.getByText("Autosize")).toBeInTheDocument()
    })

    it("does not render 'Autosize' when onAutosize is undefined", () => {
      render(<ColumnMenu {...defaultProps} onAutosize={undefined} />)

      expect(screen.queryByText("Autosize")).not.toBeInTheDocument()
    })

    it("calls onAutosize when clicking 'Autosize'", async () => {
      render(<ColumnMenu {...defaultProps} />)

      await userEvent.click(screen.getByText("Autosize"))
      expect(defaultProps.onAutosize).toHaveBeenCalled()
      expect(defaultProps.onCloseMenu).toHaveBeenCalled()
    })
  })

  describe("hide column functionality", () => {
    it("renders 'Hide column' when onHideColumn is provided", () => {
      render(<ColumnMenu {...defaultProps} onHideColumn={() => {}} />)

      expect(screen.getByText("Hide column")).toBeInTheDocument()
    })

    it("does not render 'Hide column' when onHideColumn is undefined", () => {
      render(<ColumnMenu {...defaultProps} onHideColumn={undefined} />)

      expect(screen.queryByText("Hide column")).not.toBeInTheDocument()
    })

    it("calls onHideColumn when clicking 'Hide column'", async () => {
      const onHideColumn = vi.fn()
      render(<ColumnMenu {...defaultProps} onHideColumn={onHideColumn} />)

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

      render(<ColumnMenu {...defaultProps} />)

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

  describe("statistics menu functionality", () => {
    const mockQuiver = new Quiver({ data: TEN_BY_TEN })

    it("renders 'Statistics' when data is provided and column kind supports statistics", () => {
      render(<ColumnMenu {...defaultProps} data={mockQuiver} />)

      expect(screen.getByText("Statistics")).toBeVisible()
    })

    it("does not render 'Statistics' when data is not provided", () => {
      render(<ColumnMenu {...defaultProps} data={undefined} />)

      expect(screen.queryByText("Statistics")).not.toBeInTheDocument()
    })

    it("does not render 'Statistics' for unsupported column kinds", () => {
      // Create a column with an unsupported kind (e.g., "image")
      const imageColumn = {
        ...defaultProps.column,
        kind: "image",
      }

      render(
        <ColumnMenu {...defaultProps} column={imageColumn} data={mockQuiver} />
      )

      expect(screen.queryByText("Statistics")).not.toBeInTheDocument()
    })

    it("renders 'Statistics' for text column kind", () => {
      const textColumn = TextColumn({
        title: "textColumn",
        id: "col-text",
        indexNumber: 0,
        isEditable: false,
        name: "textColumn",
        arrowType: {
          type: DataFrameCellType.DATA,
          arrowField: new Field("text_column", new Utf8(), true),
          pandasType: {
            field_name: "text_column",
            name: "text_column",
            pandas_type: "unicode",
            numpy_type: "object",
            metadata: null,
          },
        },
        isHidden: false,
        isIndex: false,
        isPinned: false,
        isStretched: false,
      })

      render(
        <ColumnMenu {...defaultProps} column={textColumn} data={mockQuiver} />
      )

      expect(screen.getByText("Statistics")).toBeVisible()
    })

    it("does not render 'Statistics' when isEditable is true", () => {
      // Statistics are hidden for editable tables (st.data_editor) because
      // they would show stale data from the original Quiver, not the edits.
      render(
        <ColumnMenu {...defaultProps} data={mockQuiver} isEditable={true} />
      )

      expect(screen.queryByText("Statistics")).not.toBeInTheDocument()
    })
  })
})
