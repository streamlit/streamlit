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

import { Info } from "@emotion-icons/material-outlined"
import { range } from "lodash-es"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
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
  StyledSummaryContent,
  StyledSummaryLabel,
  StyledSummaryValue,
  StyledTable,
  StyledTableBorder,
  StyledTableCaption,
  StyledTableCell,
  StyledTableCellFooter,
  StyledTableCellHeader,
  StyledTableContainer,
  StyledTruncationIcon,
} from "./styled-components"
import {
  computeSummary,
  getSummaryLabel,
  parseSummaryConfig,
  SummaryConfig,
} from "./summaryUtils"

export interface TableProps {
  element: ArrowProto
  data: Quiver
}

export function ArrowTable(props: Readonly<TableProps>): ReactElement {
  const table = props.data
  const { cssId, cssStyles, caption } = table.styler ?? {}
  const { numHeaderRows, numDataRows, numColumns } = table.dimensions
  const dataRowIndices = range(numDataRows)
  const borderMode = props.element.borderMode

  // Parse summary configuration from element
  const summaryConfig = parseSummaryConfig(props.element.summaryConfig ?? "")
  const isDataTruncated = props.element.isDataTruncated ?? false

  return (
    <StyledTableContainer className="stTable" data-testid="stTable">
      {cssStyles && <style>{cssStyles}</style>}
      {/* Add an extra wrapper with the border. This makes sure the border shows around
      the entire table when scrolling horizontally. See also `styled-components.ts`. */}
      <StyledTableBorder borderMode={borderMode}>
        <StyledTable id={cssId} data-testid="stTableStyledTable">
          {numHeaderRows > 0 && generateTableHeader(table, borderMode)}
          <tbody>
            {dataRowIndices.length === 0 ? (
              <tr>
                <StyledEmptyTableCell
                  data-testid="stTableStyledEmptyTableCell"
                  colSpan={numColumns || 1}
                  borderMode={borderMode}
                >
                  empty
                </StyledEmptyTableCell>
              </tr>
            ) : (
              dataRowIndices.map(rowIndex =>
                generateTableRow(table, rowIndex, numColumns, borderMode)
              )
            )}
          </tbody>
          {summaryConfig &&
            generateTableFooter(
              table,
              summaryConfig,
              borderMode,
              isDataTruncated
            )}
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
  borderMode: ArrowProto.BorderMode
): ReactElement {
  // When there are no vertical borders, we want to align the header text with the data.
  const shouldAlignWithData =
    borderMode === ArrowProto.BorderMode.NONE ||
    borderMode === ArrowProto.BorderMode.HORIZONTAL

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

            return (
              <StyledTableCellHeader
                // TODO: Update to match React best practices
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={colIndex}
                className={header.cssClass}
                scope="col"
                borderMode={borderMode}
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
  borderMode: ArrowProto.BorderMode
): ReactElement {
  return (
    <tr key={rowIndex}>
      {range(columns).map(columnIndex =>
        generateTableCell(table, rowIndex, columnIndex, borderMode)
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
  borderMode: ArrowProto.BorderMode
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
      return (
        <StyledTableCellHeader
          key={columnIndex}
          scope="row"
          id={styledCell?.cssId}
          className={styledCell?.cssClass}
          borderMode={borderMode}
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

/**
 * Generate the table footer (summary) row from a Quiver object.
 */
function generateTableFooter(
  table: Quiver,
  summaryConfig: SummaryConfig,
  borderMode: ArrowProto.BorderMode,
  isDataTruncated: boolean
): ReactElement | null {
  const { numColumns, numDataRows } = table.dimensions

  // Don't show footer if there's no data
  if (numDataRows === 0) {
    return null
  }

  return (
    <tfoot data-testid="stTableFooter">
      <tr>
        {range(numColumns).map(colIndex => {
          // Find the column name for this index
          const columnNames = table.columnNames
          const lastHeaderRow =
            columnNames && columnNames.length > 0
              ? columnNames[columnNames.length - 1]
              : []
          const columnName =
            colIndex < lastHeaderRow.length
              ? String(lastHeaderRow[colIndex])
              : ""

          // Check if this column has a summary configured
          const summaryType = summaryConfig[columnName]

          // Render empty cell if no summary for this column
          if (!summaryType) {
            return (
              <StyledTableCellFooter
                key={colIndex}
                borderMode={borderMode}
                data-testid="stTableFooterCell"
              >
                {"\u00A0"}
              </StyledTableCellFooter>
            )
          }

          // Compute and render the summary value with label
          const summaryValue = computeSummary(table, colIndex, summaryType)
          const summaryLabel = getSummaryLabel(summaryType)

          return (
            <StyledTableCellFooter
              key={colIndex}
              borderMode={borderMode}
              data-testid="stTableFooterCell"
            >
              <StyledSummaryContent>
                <StyledSummaryLabel>{summaryLabel}:</StyledSummaryLabel>
                <StyledSummaryValue>{summaryValue}</StyledSummaryValue>
                {isDataTruncated && (
                  <Tooltip
                    content="Calculated on displayed rows only"
                    placement={Placement.TOP}
                  >
                    <StyledTruncationIcon data-testid="stTableTruncationIcon">
                      <Info size={14} />
                    </StyledTruncationIcon>
                  </Tooltip>
                )}
              </StyledSummaryContent>
            </StyledTableCellFooter>
          )
        })}
      </tr>
    </tfoot>
  )
}

export default memo(ArrowTable)
