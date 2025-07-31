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

import React, { memo, ReactElement } from "react"

import range from "lodash/range"

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

import {
  StyledEmptyTableCell,
  StyledTable,
  StyledTableBorder,
  StyledTableCaption,
  StyledTableCell,
  StyledTableCellHeader,
  StyledTableContainer,
} from "./styled-components"

export interface TableProps {
  element: Quiver
}

export function ArrowTable(props: Readonly<TableProps>): ReactElement {
  const table = props.element
  const { cssId, cssStyles, caption } = table.styler ?? {}
  const { numHeaderRows, numDataRows, numColumns } = table.dimensions
  const dataRowIndices = range(numDataRows)

  return (
    <StyledTableContainer className="stTable" data-testid="stTable">
      {cssStyles && <style>{cssStyles}</style>}
      {/* Add an extra wrapper with the border. This makes sure the border shows around
      the entire table when scrolling horizontally. See also `styled-components.ts`. */}
      <StyledTableBorder>
        <StyledTable id={cssId} data-testid="stTableStyledTable">
          {numHeaderRows > 0 && generateTableHeader(table)}
          <tbody>
            {dataRowIndices.length === 0 ? (
              <tr>
                <StyledEmptyTableCell
                  data-testid="stTableStyledEmptyTableCell"
                  colSpan={numColumns || 1}
                >
                  empty
                </StyledEmptyTableCell>
              </tr>
            ) : (
              dataRowIndices.map(rowIndex =>
                generateTableRow(table, rowIndex, numColumns)
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
function generateTableHeader(table: Quiver): ReactElement {
  return (
    <thead>
      {getStyledHeaders(table).map((headerRow, rowIndex) => (
        // TODO: Update to match React best practices
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <tr key={rowIndex}>
          {headerRow.map((header, colIndex) => (
            <StyledTableCellHeader
              // TODO: Update to match React best practices
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={colIndex}
              className={header.cssClass}
              scope="col"
            >
              <StreamlitMarkdown
                source={header.name || "\u00A0"}
                allowHTML={false}
              />
            </StyledTableCellHeader>
          ))}
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
  columns: number
): ReactElement {
  return (
    <tr key={rowIndex}>
      {range(columns).map(columnIndex =>
        generateTableCell(table, rowIndex, columnIndex)
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
  columnIndex: number
): ReactElement {
  const { type, content, contentType } = table.getCell(rowIndex, columnIndex)
  const styledCell = getStyledCell(table, rowIndex, columnIndex)

  let formattedContent =
    styledCell?.displayContent || formatArrowCell(content, contentType)
  let hasStylerTooltip: boolean = false

  const style: React.CSSProperties = {
    textAlign: isNumericType(contentType) ? "right" : "left",
  }

  if (
    formattedContent &&
    formattedContent.endsWith(`<span class="pd-t"></span>`)
  ) {
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
      return (
        <StyledTableCellHeader
          key={columnIndex}
          scope="row"
          id={styledCell?.cssId}
          className={styledCell?.cssClass}
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
