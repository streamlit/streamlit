/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ComponentType, ReactElement } from "react"
import { ChevronTop, ChevronBottom } from "@emotion-icons/open-iconic"
import Icon from "src/components/shared/Icon"
import Tooltip, {
  Placement,
  OverflowTooltip,
  StyledEllipsizedDiv,
} from "src/components/shared/Tooltip"
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
  style: React.CSSProperties

  /**
   * The HTML contents of the cell. Added to the DOM as a child of this
   * DataFrameCell.
   */
  contents: string

  /** The cell's CSS id */
  id?: string

  /** The cell's CSS class */
  className: string

  /** True if this cell holds a number */
  isNumeric: boolean

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
  className,
  isNumeric,
  id,
  headerClickedCallback,
}: DataFrameCellProps): ReactElement {
  const isHeader = rowIndex === 0

  let onClick
  let role
  let tabIndex

  if (headerClickedCallback != null) {
    onClick = () => headerClickedCallback(columnIndex)
    role = "button"
    tabIndex = 0
  }

  return (
    // (ESLint erroneously believes we're not assigning a role to our clickable div)
    // eslint-disable-next-line

    <CellType
      // @ts-ignore
      style={style}
      className={className}
      id={id}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      data-testid={CellType.displayName}
      data-test-sort-direction={columnSortDirection}
    >
      {isHeader ? (
        <HeaderContentsWithTooltip
          columnIndex={columnIndex}
          columnSortDirection={columnSortDirection}
          contents={contents}
          headerClickedCallback={headerClickedCallback}
          isNumeric={isNumeric}
          rowIndex={rowIndex}
          sortedByUser={sortedByUser}
        />
      ) : (
        <CellContentsWithTooltip contents={contents} isNumeric={isNumeric} />
      )}
    </CellType>
  )
}

function SortIcon({
  sortDirection,
}: {
  sortDirection?: SortDirection
}): ReactElement {
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
      return <></>
  }
}

interface HeaderContentsProps {
  columnIndex: number
  columnSortDirection?: SortDirection
  contents: string
  headerClickedCallback?: (columnIndex: number) => void
  isNumeric: boolean
  rowIndex: number
  sortedByUser: boolean
}

function HeaderContentsWithTooltip({
  columnIndex,
  columnSortDirection,
  contents,
  headerClickedCallback,
  isNumeric,
  rowIndex,
  sortedByUser,
}: HeaderContentsProps): ReactElement {
  let tooltipContents = contents

  const isDescending = columnSortDirection === SortDirection.DESCENDING

  if (headerClickedCallback != null) {
    const columnName = contents.length ? `"${contents}"` : "this index column"
    tooltipContents =
      columnSortDirection == null
        ? `Sort by ${columnName}`
        : `Sorted by ${columnName} (${
            isDescending ? "descending" : "ascending"
          })`
  }

  return (
    <Tooltip
      content={tooltipContents}
      placement={Placement.BOTTOM_LEFT}
      style={{ width: "100%" }}
    >
      <StyledEllipsizedDiv
        style={{
          textAlign: isNumeric ? "right" : undefined,
          flex: 1,
        }}
      >
        {contents}
      </StyledEllipsizedDiv>

      {sortedByUser && <SortIcon sortDirection={columnSortDirection} />}
    </Tooltip>
  )
}

interface CellContentsProps {
  contents: string
  isNumeric: boolean
}

function CellContentsWithTooltip({
  contents,
  isNumeric,
}: CellContentsProps): ReactElement {
  return (
    <OverflowTooltip
      content={contents}
      placement={Placement.AUTO}
      style={{
        textAlign: isNumeric ? "right" : undefined,
      }}
    >
      {contents}
    </OverflowTooltip>
  )
}
