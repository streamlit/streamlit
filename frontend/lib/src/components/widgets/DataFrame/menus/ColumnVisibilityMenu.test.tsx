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
import { Field, Int64, Utf8 } from "apache-arrow"

import {
  BaseColumn,
  NumberColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { render } from "~lib/test_util"

import ColumnVisibilityMenu, {
  ColumnVisibilityMenuProps,
} from "./ColumnVisibilityMenu"

/**
 * Renders the ColumnVisibilityMenu and waits for the popover to fully mount.
 * Baseui's Popover performs internal async state updates (focus/positioning),
 * which can cause act() warnings if not awaited.
 */
async function renderAndWaitForPopover(
  ui: ReactElement
): Promise<ReturnType<typeof render>> {
  const result = render(ui)
  // Wait for the popover's async state updates to complete
  await waitFor(() => {
    // The popover content should be visible when isOpen=true
    expect(
      screen.queryByTestId("stDataFrameColumnVisibilityMenu")
    ).toBeVisible()
  })
  return result
}

const MOCK_COLUMNS: BaseColumn[] = [
  TextColumn({
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("index-0", new Utf8(), true),
      pandasType: {
        field_name: "index-0",
        name: "index-0",
        pandas_type: "unicode",
        numpy_type: "unicode",
        metadata: null,
      },
    },
    id: "index-0",
    name: "",
    indexNumber: 0,
    isEditable: true,
    isHidden: false,
    isIndex: true,
    isPinned: true,
    isStretched: false,
    title: "",
  }),
  NumberColumn({
    id: "_column-1",
    name: "column_1",
    title: "Column 1",
    indexNumber: 1,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_1", new Int64(), true),
      pandasType: {
        field_name: "column_1",
        name: "column_1",
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
  TextColumn({
    id: "_column-2",
    name: "column_2",
    title: "Column 2",
    indexNumber: 2,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_2", new Utf8(), true),
      pandasType: {
        field_name: "column_2",
        name: "column_2",
        pandas_type: "unicode",
        numpy_type: "object",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: true,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
]

describe("DataFrame ColumnVisibilityMenu", () => {
  const defaultProps: ColumnVisibilityMenuProps = {
    columns: MOCK_COLUMNS,
    columnOrder: [],
    setColumnOrder: vi.fn(),
    hideColumn: vi.fn(),
    showColumn: vi.fn(),
    children: <button type="button">Toggle Visibility</button>,
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the visibility menu with all columns", async () => {
    await renderAndWaitForPopover(<ColumnVisibilityMenu {...defaultProps} />)

    expect(screen.getByTestId("stDataFrameColumnVisibilityMenu")).toBeVisible()
    expect(screen.getByText("Column 1")).toBeVisible()
    expect(screen.getByText("Column 2")).toBeVisible()
    expect(screen.getByText("(index)")).toBeVisible()
    expect(screen.getByText("Select all")).toBeVisible()
  })

  it("shows correct checkbox states based on column visibility", async () => {
    await renderAndWaitForPopover(<ColumnVisibilityMenu {...defaultProps} />)

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes[0]).not.toBeChecked() // Select All (visible but indeterminate)
    expect(checkboxes[1]).toBeChecked() // Index (visible)
    expect(checkboxes[2]).toBeChecked() // Column 1 (visible)
    expect(checkboxes[3]).not.toBeChecked() // Column 2 (hidden)
  })

  it("calls hideColumn when unchecking a visible column", async () => {
    await renderAndWaitForPopover(<ColumnVisibilityMenu {...defaultProps} />)

    await userEvent.click(screen.getByLabelText("Column 1"))
    expect(defaultProps.hideColumn).toHaveBeenCalledWith("_column-1")
  })

  it("calls showColumn when checking a hidden column", async () => {
    await renderAndWaitForPopover(<ColumnVisibilityMenu {...defaultProps} />)

    await userEvent.click(screen.getByLabelText("Column 2"))
    expect(defaultProps.showColumn).toHaveBeenCalledWith("_column-2")
  })

  it("renders children component", async () => {
    await renderAndWaitForPopover(<ColumnVisibilityMenu {...defaultProps} />)

    expect(screen.getByText("Toggle Visibility")).toBeInTheDocument()
  })

  it("doesn't render menu content when closed", () => {
    render(<ColumnVisibilityMenu {...defaultProps} isOpen={false} />)

    expect(
      screen.queryByTestId("stDataFrameColumnVisibilityMenu")
    ).not.toBeInTheDocument()
  })

  it("considers columns not in columnOrder as hidden", async () => {
    const propsWithColumnOrder = {
      ...defaultProps,
      columnOrder: ["_column-2"], // Only column 2 is in the order
    }

    await renderAndWaitForPopover(
      <ColumnVisibilityMenu {...propsWithColumnOrder} />
    )

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes[0]).not.toBeChecked() // Select All (visible, ignored by columnOrder)
    expect(checkboxes[1]).toBeChecked() // Index (visible, ignored by columnOrder)
    expect(checkboxes[2]).not.toBeChecked() // Column 1 (hidden via columnOrder)
    expect(checkboxes[3]).not.toBeChecked() // Column 2 (hidden via isHidden)
  })

  it("shows column and updates columnOrder when checking a column hidden via columnOrder", async () => {
    const propsWithColumnOrder = {
      ...defaultProps,
      columnOrder: ["_column-2"],
    }

    await renderAndWaitForPopover(
      <ColumnVisibilityMenu {...propsWithColumnOrder} />
    )

    await userEvent.click(screen.getByLabelText("Column 1"))
    expect(defaultProps.showColumn).toHaveBeenCalledWith("_column-1")
    expect(defaultProps.setColumnOrder).toHaveBeenCalledOnce()
  })

  it("doesn't update columnOrder when showing a column hidden via isHidden", async () => {
    const propsWithColumnOrder = {
      ...defaultProps,
      columnOrder: [],
    }

    await renderAndWaitForPopover(
      <ColumnVisibilityMenu {...propsWithColumnOrder} />
    )

    await userEvent.click(screen.getByLabelText("Column 2"))
    expect(defaultProps.showColumn).toHaveBeenCalledWith("_column-2")
    expect(defaultProps.setColumnOrder).not.toHaveBeenCalled()
  })

  it("calls showColumn on all columns when selecting an indeterminate select all", async () => {
    await renderAndWaitForPopover(<ColumnVisibilityMenu {...defaultProps} />)

    await userEvent.click(screen.getByLabelText("Select all")) // (Indeterminate, column 2 is hidden)
    expect(defaultProps.showColumn).toHaveBeenCalledWith("index-0")
    expect(defaultProps.showColumn).toHaveBeenCalledWith("_column-1")
    expect(defaultProps.showColumn).toHaveBeenCalledWith("_column-2")
  })

  it("calls showColumn on all columns when selecting a unchecked select all", async () => {
    const allHiddenProps = {
      ...defaultProps,
      columns: MOCK_COLUMNS.map(c => ({ ...c, isHidden: true })),
    }

    await renderAndWaitForPopover(<ColumnVisibilityMenu {...allHiddenProps} />)

    await userEvent.click(screen.getByLabelText("Select all"))
    expect(defaultProps.showColumn).toHaveBeenCalledWith("index-0")
    expect(defaultProps.showColumn).toHaveBeenCalledWith("_column-1")
    expect(defaultProps.showColumn).toHaveBeenCalledWith("_column-2")
  })

  it("calls hideColumn on all columns when clicking a checked select all", async () => {
    const allVisibleProps = {
      ...defaultProps,
      columns: MOCK_COLUMNS.map(c => ({ ...c, isHidden: false })),
    }

    await renderAndWaitForPopover(
      <ColumnVisibilityMenu {...allVisibleProps} />
    )

    await userEvent.click(screen.getByLabelText("Select all"))
    expect(defaultProps.hideColumn).toHaveBeenCalledWith("index-0")
    expect(defaultProps.hideColumn).toHaveBeenCalledWith("_column-1")
    expect(defaultProps.hideColumn).toHaveBeenCalledWith("_column-2")
  })

  it("select all reflects columnOrder-hidden columns when none are explicitly hidden", async () => {
    const props = {
      ...defaultProps,
      columns: MOCK_COLUMNS.map(c => ({ ...c, isHidden: false })),
      columnOrder: ["index-0", "_column-1"], // exclude _column-2 via order
    }

    await renderAndWaitForPopover(<ColumnVisibilityMenu {...props} />)

    const selectAll = screen.getByLabelText("Select all")
    expect(selectAll).not.toBeChecked()
    // Indeterminate state should be reflected via aria-checked="mixed" if supported
    expect(selectAll).toHaveAttribute("aria-checked", "mixed")
  })
})
