import React, { ComponentType, ReactElement } from "react"
import { ChevronTop, ChevronBottom } from "@emotion-icons/open-iconic"
import Icon from "src/components/shared/Icon"
import { SortDirection } from "./SortDirection"
import { StyledSortIcon } from "./styled-components"

export interface DataFrameCellProps {
  /** The cell's column index in the DataFrame */
  columnIndex: number

  /** The cell's row index in the DataFrame */
  rowIndex: number

  /** The cell's component to render */
  CellType: ComponentType

  /** Additional css styling for the cell */
  style: Record<string, unknown>

  /**
   * The HTML contents of the cell. Added to the DOM as a child of this
   * DataFrameCel.
   */
  contents: string

  /**
   * If true, then the table's sorting was manually set by the user, by
   * clicking on a column header. We only show the sort arrow when this is
   * true.
   */
  sortedByUser: boolean

  /**
   * The {@link SortDirection} for this column, or undefined if the column is
   * unsorted. No sorting is done here - this property is used to determine
   * which, if any, sort icon to draw in column-header cells.
   */
  columnSortDirection?: SortDirection

  /**
   * An optional callback that will be called when a column header is clicked.
   * (The property is ignored for non-header cells). The callback will be passed this
   * cell's columnIndex.
   *
   * {@link DataFrame} uses this to toggle column sorting.
   */
  headerClickedCallback?: (columnIndex: number) => void
}

export default function DataFrameCell({
  CellType,
  columnIndex,
  contents,
  rowIndex,
  sortedByUser,
  style,
  columnSortDirection,
  headerClickedCallback,
}: DataFrameCellProps): ReactElement {
  let onClick
  let role
  let tabIndex
  let title = contents

  const isDescending = columnSortDirection === SortDirection.DESCENDING

  if (headerClickedCallback != null && rowIndex === 0) {
    onClick = () => headerClickedCallback(columnIndex)
    role = "button"
    tabIndex = 0
    title =
      columnSortDirection == null
        ? `Sort by column "${contents}"`
        : `Sorted by column "${contents}" (${
            isDescending ? "descending" : "ascending"
          })`
  }

  // The sort icon is only drawn in the top row
  const sortIcon =
    rowIndex === 0 ? drawSortIcon(columnSortDirection) : undefined

  return (
    // (ESLint erroneously believes we're not assigning a role to our clickable div)
    // eslint-disable-next-line

    <CellType
      // @ts-ignore
      style={style}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      title={title}
      data-testid={CellType.displayName}
      data-test-sort-direction={columnSortDirection}
    >
      {contents}
      {sortedByUser ? sortIcon : ""}
    </CellType>
  )
}

function drawSortIcon(sortDirection?: SortDirection): React.ReactNode {
  // If these icons are changed, you may also need to update DataFrame.SORT_ICON_WIDTH
  // to ensure proper column width padding
  switch (sortDirection) {
    case SortDirection.ASCENDING:
      return (
        <StyledSortIcon data-testid="sortIcon">
          <Icon content={ChevronTop} size="xs" margin="0 0 0 twoXS" />
        </StyledSortIcon>
      )

    case SortDirection.DESCENDING:
      return (
        <StyledSortIcon data-testid="sortIcon">
          <Icon content={ChevronBottom} size="xs" margin="0 0 0 twoXS" />
        </StyledSortIcon>
      )

    default:
      return null
  }
}
