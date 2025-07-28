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

/**
 * Utility functions to get Pandas styler information from a Quiver object.
 */

import { Quiver } from "./Quiver"

/**
 * A styled header object with information from Pandas Styler.
 */
export interface StyledHeader {
  /** The column header name. */
  name: string
  /** The CSS class to apply to the column header. */
  cssClass: string
}

/**
 * A styled cell object with information from Pandas Styler.
 */
export interface StyledCell {
  /** CSS id to apply to the cell. */
  cssId: string
  /** CSS class to apply to the cell. */
  cssClass: string
  /** The cell's formatted content string, if the DataFrame was created with a Styler. */
  displayContent: string | undefined
}

/**
 * Returns a row-major matrix of styled index & column header names
 * from the provided Quiver object. It returns names as well as
 * css classes to match the pandas styling.
 *
 * This is a matrix (multidimensional array) to support multi-level headers.
 */
export function getStyledHeaders(data: Quiver): StyledHeader[][] {
  const { numIndexColumns } = data.dimensions

  // Create a matrix to hold all headers
  const headers: StyledHeader[][] = []

  // For each header row
  for (let rowIndex = 0; rowIndex < data.columnNames.length; rowIndex++) {
    const headerRow: StyledHeader[] = []

    // For each column in current header row:
    for (
      let colIndex = 0;
      colIndex < data.columnNames[rowIndex].length;
      colIndex++
    ) {
      // Add blank cells for index columns in header rows
      const cssClasses = []
      if (colIndex < numIndexColumns) {
        cssClasses.push("blank")
        cssClasses.push("index_name")
        cssClasses.push(`level${rowIndex}`)
      } else {
        // Column label cells include:
        // - col_heading
        // - col<n> where n is the numeric position of the column
        // - level<k> where k is the level in a MultiIndex
        // See: https://pandas.pydata.org/docs/user_guide/style.html#CSS-Classes-and-Ids
        cssClasses.push("col_heading")
        cssClasses.push(`level${rowIndex}`)
        cssClasses.push(`col${colIndex - numIndexColumns}`)
      }

      headerRow.push({
        name: data.columnNames[rowIndex][colIndex],
        cssClass: cssClasses.join(" "),
      })
    }

    headers.push(headerRow)
  }

  return headers
}

/**
 * Returns a styled cell object based on the cell data from the Quiver (Arrow) object.
 *
 * @param data - The Quiver object.
 * @param rowIndex - The row index of the cell (0-indexed based on the first data row)
 * @param columnIndex - The column index of the cell (0-indexed based on the first index or data column)
 * @returns A styled cell object or undefined if the dataframe is not styled.
 */
export function getStyledCell(
  data: Quiver,
  rowIndex: number,
  columnIndex: number
): StyledCell | undefined {
  if (!data.styler || !data.styler.cssId) {
    return undefined
  }

  const { numIndexColumns, numDataRows, numColumns } = data.dimensions

  if (rowIndex < 0 || rowIndex >= numDataRows) {
    throw new Error(`Row index is out of range: ${rowIndex}`)
  }
  if (columnIndex < 0 || columnIndex >= numColumns) {
    throw new Error(`Column index is out of range: ${columnIndex}`)
  }

  const isIndexCell = columnIndex < numIndexColumns

  if (isIndexCell) {
    // Index label cells include:
    // - row_heading
    // - row<n> where n is the numeric position of the row
    // - level<k> where k is the level in a MultiIndex
    // See: https://pandas.pydata.org/docs/user_guide/style.html#CSS-Classes-and-Ids
    const cssClass = [
      `row_heading`,
      `level${columnIndex}`,
      `row${rowIndex}`,
    ].join(" ")

    return {
      cssId: `${data.styler.cssId}_level${columnIndex}_row${rowIndex}`,
      cssClass,
      displayContent: undefined,
    }
  }

  const dataColumnIndex = columnIndex - numIndexColumns
  // Data cells include:
  // - data
  // - row<n> where n is the numeric position of the row
  // - col<n> where n is the numeric position of the column
  // See: https://pandas.pydata.org/docs/user_guide/style.html#CSS-Classes-and-Ids
  const cssClass = ["data", `row${rowIndex}`, `col${dataColumnIndex}`].join(
    " "
  )

  const displayContent = data.styler?.displayValues
    ? (data.styler.displayValues.getCell(rowIndex, columnIndex)
        .content as string)
    : undefined

  return {
    cssId: `${data.styler.cssId}_row${rowIndex}_col${dataColumnIndex}`,
    cssClass: cssClass,
    displayContent,
  }
}
