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

import { memo, ReactElement, useMemo } from "react"

import { range } from "lodash-es"

import { streamlit, Table as TableProto } from "@streamlit/protobuf"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { format as formatArrowCell } from "~lib/dataframes/arrowFormatUtils"
import {
  DataFrameCellType,
  isNumericType,
} from "~lib/dataframes/arrowTypeUtils"
import {
  getStyledCell,
  getStyledHeaders,
} from "~lib/dataframes/pandasStylerUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { convertRemToPx } from "~lib/theme"

import {
  StickyType,
  StyledEmptyTableCell,
  StyledTable,
  StyledTableBorder,
  StyledTableCaption,
  StyledTableCell,
  StyledTableCellHeader,
  StyledTableContainer,
} from "./styled-components"

export interface TableProps {
  element: TableProto
  data: Quiver
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}

// Fallback offset value (in rem) used for sticky positioning when multiple header rows
// exist. This approximates typical row height to ensure sticky headers don't overlap.
// The actual size may vary based on content, but this default works reasonably well.
// Header row: fontSize (1rem) * lineHeight (1.5) + vertical padding (0.5rem) = 2rem
const FALLBACK_HEADER_ROW_OFFSET_REM = "2rem"

function getStickyOffset(index: number, stepPx: number): number {
  return index * stepPx
}

/**
 * Determine the sticky type based on whether the cell should stick to top, left, or both.
 */
function getStickyType(stickyTop: boolean, stickyLeft: boolean): StickyType {
  if (stickyTop && stickyLeft) {
    return "corner"
  }
  if (stickyTop) {
    return "header"
  }
  if (stickyLeft) {
    return "index"
  }
  return undefined
}

export function ArrowTable(props: Readonly<TableProps>): ReactElement {
  const table = props.data
  const { cssId, cssStyles, caption } = table.styler ?? {}
  const { numHeaderRows, numDataRows, numColumns, numIndexColumns } =
    table.dimensions
  const dataRowIndices = range(numDataRows)
  const borderMode = props.element.borderMode

  // Scrolling is enabled when a fixed pixel height or width is specified
  const hasScrollableHeight = Boolean(props.heightConfig?.pixelHeight)
  const hasScrollableWidth = Boolean(props.widthConfig?.pixelWidth)

  // Table sizes to content (width="content") instead of filling space
  const useContentWidth = Boolean(props.widthConfig?.useContent)

  // Enable sticky headers/index when scrolling is enabled
  // Note: Sticky index is only enabled for single index columns to avoid
  // complex offset calculations for multi-index DataFrames.
  const enableStickyHeaders = hasScrollableHeight
  const enableStickyIndex = hasScrollableWidth && numIndexColumns === 1

  // Truncate only when fixed pixel width is configured.
  const truncateContent = hasScrollableWidth

  const headerTopOffsets = useMemo(
    () =>
      range(numHeaderRows).map(index =>
        getStickyOffset(index, convertRemToPx(FALLBACK_HEADER_ROW_OFFSET_REM))
      ),
    [numHeaderRows]
  )

  // With sticky index limited to single index columns, the offset is always 0
  const indexLeftOffsets = [0]

  return (
    <StyledTableContainer className="stTable" data-testid="stTable">
      {cssStyles && <style>{cssStyles}</style>}
      {/* Add an extra wrapper with the border. This makes sure the border shows around
      the entire table when scrolling horizontally. See also `styled-components.ts`. */}
      <StyledTableBorder
        borderMode={borderMode}
        hasScrollableHeight={hasScrollableHeight}
        // A11y: When scrolling is enabled, make the wrapper focusable so keyboard users
        // can discover and scroll the table content
        tabIndex={hasScrollableHeight || hasScrollableWidth ? 0 : undefined}
        role={hasScrollableHeight || hasScrollableWidth ? "region" : undefined}
        aria-label={
          hasScrollableHeight || hasScrollableWidth
            ? "Scrollable table"
            : undefined
        }
      >
        <StyledTable
          id={cssId}
          data-testid="stTableStyledTable"
          useContentWidth={useContentWidth}
          hasScrollableWidth={hasScrollableWidth}
        >
          {numHeaderRows > 0 &&
            generateTableHeader(
              table,
              borderMode,
              enableStickyHeaders,
              enableStickyIndex,
              numIndexColumns,
              headerTopOffsets,
              indexLeftOffsets,
              truncateContent
            )}
          <tbody>
            {dataRowIndices.length === 0 ? (
              <tr>
                <StyledEmptyTableCell
                  data-testid="stTableStyledEmptyTableCell"
                  colSpan={numColumns || 1}
                  borderMode={borderMode}
                  truncateContent={truncateContent}
                >
                  empty
                </StyledEmptyTableCell>
              </tr>
            ) : (
              dataRowIndices.map(rowIndex =>
                generateTableRow(
                  table,
                  rowIndex,
                  numColumns,
                  borderMode,
                  enableStickyIndex,
                  numIndexColumns,
                  indexLeftOffsets,
                  truncateContent
                )
              )
            )}
          </tbody>
        </StyledTable>
      </StyledTableBorder>
      {/* One negative side effect of having the border on a wrapper is that we need
      to put the caption outside of <table> and use a div, so it shows up outside of the border.
      This is not great for accessibility. But I think it's fine because adding captions
      isn't a native feature (you can only do it via Pandas Styler's `set_caption`
      function) and I couldn't find a single example on GitHub that actually does this
      for `st.table`. We might want to revisit this if we add captions/labels as a
      native feature or do a pass on accessibility. */}
      {caption && <StyledTableCaption>{caption}</StyledTableCaption>}
    </StyledTableContainer>
  )
}

/**
 * Generate the table header rows from a Quiver object.
 */
function generateTableHeader(
  table: Quiver,
  borderMode: TableProto.BorderMode,
  enableStickyHeaders: boolean,
  enableStickyIndex: boolean,
  numIndexColumns: number,
  headerTopOffsets: number[],
  indexLeftOffsets: number[],
  truncateContent: boolean
): ReactElement {
  // When there are no vertical borders, we want to align the header text with the data.
  const shouldAlignWithData =
    borderMode === TableProto.BorderMode.NONE ||
    borderMode === TableProto.BorderMode.HORIZONTAL

  return (
    <thead>
      {getStyledHeaders(table).map((headerRow, rowIndex) => (
        // TODO: Update to match React best practices
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <tr key={rowIndex}>
          {headerRow.map((header, colIndex) => {
            // Determine alignment based on column data type when no vertical borders
            let textAlign: React.CSSProperties["textAlign"] = "inherit"
            if (shouldAlignWithData && table.dimensions.numDataRows > 0) {
              const { contentType } = table.getCell(0, colIndex)
              textAlign = isNumericType(contentType) ? "right" : "left"
            }

            // Determine if this cell should be sticky
            const isIndexColumn = colIndex < numIndexColumns
            const stickyTop = enableStickyHeaders
            const stickyLeft = enableStickyIndex && isIndexColumn
            const stickyTopOffset = stickyTop
              ? headerTopOffsets[rowIndex]
              : undefined
            const stickyLeftOffset = stickyLeft
              ? indexLeftOffsets[colIndex]
              : undefined
            const stickyType = getStickyType(stickyTop, stickyLeft)

            return (
              <StyledTableCellHeader
                // TODO: Update to match React best practices
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={colIndex}
                className={header.cssClass}
                scope="col"
                borderMode={borderMode}
                stickyType={stickyType}
                stickyTopOffset={stickyTopOffset}
                stickyLeftOffset={stickyLeftOffset}
                truncateContent={truncateContent}
                style={{ textAlign }}
              >
                <StreamlitMarkdown
                  source={header.name || "\u00A0"}
                  allowHTML={false}
                />
              </StyledTableCellHeader>
            )
          })}
        </tr>
      ))}
    </thead>
  )
}

/**
 * Generate a table data row from a Quiver object.
 */
function generateTableRow(
  table: Quiver,
  rowIndex: number,
  columns: number,
  borderMode: TableProto.BorderMode,
  enableStickyIndex: boolean,
  numIndexColumns: number,
  indexLeftOffsets: number[],
  truncateContent: boolean
): ReactElement {
  return (
    <tr key={rowIndex}>
      {range(columns).map(columnIndex =>
        generateTableCell(
          table,
          rowIndex,
          columnIndex,
          borderMode,
          enableStickyIndex,
          numIndexColumns,
          indexLeftOffsets,
          truncateContent
        )
      )}
    </tr>
  )
}

/**
 * Generate a table cell from a Quiver object.
 */
function generateTableCell(
  table: Quiver,
  rowIndex: number,
  columnIndex: number,
  borderMode: TableProto.BorderMode,
  enableStickyIndex: boolean,
  numIndexColumns: number,
  indexLeftOffsets: number[],
  truncateContent: boolean
): ReactElement {
  const { type, content, contentType } = table.getCell(rowIndex, columnIndex)
  const styledCell = getStyledCell(table, rowIndex, columnIndex)

  let formattedContent =
    styledCell?.displayContent || formatArrowCell(content, contentType)
  let hasStylerTooltip: boolean = false

  const style: React.CSSProperties = {
    textAlign: isNumericType(contentType) ? "right" : "left",
  }

  if (formattedContent?.endsWith(`<span class="pd-t"></span>`)) {
    // This is a bit hacky, but to support the Pandas Styler's tooltip feature,
    // we need to convert the specific HTML element (used for tooltips) from
    // the display value into an actual span element.
    formattedContent = formattedContent.replace(
      /<span class="pd-t"><\/span>$/,
      ""
    )
    hasStylerTooltip = true
  }
  switch (type) {
    // Index cells are from index columns which only exist if the DataFrame was created
    // based on a Pandas DataFrame.
    case DataFrameCellType.INDEX: {
      // Determine if this index cell should be sticky
      const isIndexColumn = columnIndex < numIndexColumns
      const stickyType =
        enableStickyIndex && isIndexColumn ? "index" : undefined
      const stickyLeftOffset =
        stickyType === "index" ? indexLeftOffsets[columnIndex] : undefined

      return (
        <StyledTableCellHeader
          key={columnIndex}
          scope="row"
          id={styledCell?.cssId}
          className={styledCell?.cssClass}
          borderMode={borderMode}
          stickyType={stickyType}
          stickyLeftOffset={stickyLeftOffset}
          truncateContent={truncateContent}
        >
          {hasStylerTooltip && <span className="pd-t" />}
          <StreamlitMarkdown
            source={formattedContent || "\u00A0"}
            allowHTML={false}
          />
        </StyledTableCellHeader>
      )
    }
    case DataFrameCellType.DATA: {
      return (
        <StyledTableCell
          key={columnIndex}
          id={styledCell?.cssId}
          className={styledCell?.cssClass}
          style={style}
          borderMode={borderMode}
          truncateContent={truncateContent}
        >
          {hasStylerTooltip && <span className="pd-t" />}
          <StreamlitMarkdown
            source={formattedContent || "\u00A0"}
            allowHTML={false}
          />
        </StyledTableCell>
      )
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TODO: Fix this
      throw new Error(`Cannot parse type "${type}".`)
    }
  }
}

export default memo(ArrowTable)
