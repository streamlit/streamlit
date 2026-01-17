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

import { screen } from "@testing-library/react"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import { INDEX_IDENTIFIER } from "~lib/dataframes/constants"
import { Quiver } from "~lib/dataframes/Quiver"
import { EMPTY, NAMED_INDEX, UNICODE } from "~lib/mocks/arrow"
import { render } from "~lib/test_util"

import { ArrowTable, TableProps } from "./ArrowTable"

const getProps = (data: Uint8Array): TableProps => ({
  element: ArrowProto.create({ borderMode: ArrowProto.BorderMode.ALL }),
  data: new Quiver({ data }),
})

describe("st._arrow_table", () => {
  it("renders without crashing", () => {
    const props = getProps(UNICODE)
    render(<ArrowTable {...props} />)
    const tableElement = screen.getByTestId("stTable")
    expect(tableElement).toBeInTheDocument()
    expect(tableElement).toHaveClass("stTable")

    expect(screen.getByTestId("stTableStyledTable")).toBeInTheDocument()
    expect(
      screen.queryByTestId("stTableStyledEmptyTableCell")
    ).not.toBeInTheDocument()
  })

  it("renders an empty row", () => {
    const props = getProps(EMPTY)
    render(<ArrowTable {...props} />)

    expect(screen.getByTestId("stTable")).toBeInTheDocument()
    expect(screen.getByTestId("stTableStyledTable")).toBeInTheDocument()
    expect(
      screen.getByTestId("stTableStyledEmptyTableCell")
    ).toBeInTheDocument()
  })

  it("renders with all borders when border=true", () => {
    const modifiedProps: TableProps = {
      element: ArrowProto.create({ borderMode: ArrowProto.BorderMode.ALL }),
      data: new Quiver({ data: UNICODE }),
    }

    const { container } = render(<ArrowTable {...modifiedProps} />)

    // Check that the table border wrapper has border styling
    const tableBorder = container.querySelector(
      '[data-testid="stTable"] > div'
    ) as HTMLElement
    expect(tableBorder).toBeTruthy()
    const borderStyle = getComputedStyle(tableBorder)
    expect(borderStyle.borderStyle).toBe("solid")
  })

  it("renders without borders when border=false", () => {
    // Create a Quiver with border=false
    const modifiedProps: TableProps = {
      element: ArrowProto.create({ borderMode: ArrowProto.BorderMode.NONE }),
      data: new Quiver({ data: UNICODE }),
    }

    const { container } = render(<ArrowTable {...modifiedProps} />)

    // Check that the table border wrapper has no border styling
    const tableBorder = container.querySelector(
      '[data-testid="stTable"] > div'
    )
    expect(tableBorder).toHaveStyle("border: none")

    // Check that table cells have no bottom borders
    const tableCell = container.querySelector("td")
    expect(tableCell).toHaveStyle("border-bottom: none")
  })

  it("renders with horizontal borders only when border='horizontal'", () => {
    const modifiedProps: TableProps = {
      element: ArrowProto.create({
        borderMode: ArrowProto.BorderMode.HORIZONTAL,
      }),
      data: new Quiver({ data: UNICODE }),
    }

    const { container } = render(<ArrowTable {...modifiedProps} />)

    // Check that the table border wrapper has no border (horizontal borders are on cells)
    const tableBorder = container.querySelector(
      '[data-testid="stTable"] > div'
    )
    expect(tableBorder).toHaveStyle("border: none")

    // Check that table cells have bottom borders (horizontal lines between rows)
    const tableCell = container.querySelector("td") as HTMLElement
    expect(tableCell).toBeTruthy()
    const cellStyle = getComputedStyle(tableCell)
    expect(cellStyle.borderBottomStyle).toBe("solid")
  })

  describe("index column visibility", () => {
    it("renders index columns by default", () => {
      const props: TableProps = {
        element: ArrowProto.create({ borderMode: ArrowProto.BorderMode.ALL }),
        data: new Quiver({ data: NAMED_INDEX }),
      }

      const { container } = render(<ArrowTable {...props} />)

      // NAMED_INDEX has 1 index column + 2 data columns = 3 total columns
      const headerRow = container.querySelector("thead tr")
      expect(headerRow).toBeTruthy()
      const headerCells = headerRow?.querySelectorAll("th")
      expect(headerCells?.length).toBe(3)

      // Check that the first header is the index column (named "INDEX")
      const firstHeader = headerCells?.[0]
      expect(firstHeader?.textContent).toContain("INDEX")

      // Check data rows also have 3 columns
      const dataRow = container.querySelector("tbody tr")
      expect(dataRow).toBeTruthy()
      const dataCells = dataRow?.querySelectorAll("th, td")
      expect(dataCells?.length).toBe(3)

      // First cell should be a th (index column)
      const firstDataCell = dataCells?.[0]
      expect(firstDataCell?.tagName).toBe("TH")
    })

    it("hides index columns when configured", () => {
      const columnConfig = JSON.stringify({
        [INDEX_IDENTIFIER]: { hidden: true },
      })

      const props: TableProps = {
        element: ArrowProto.create({
          borderMode: ArrowProto.BorderMode.ALL,
          columns: columnConfig,
        }),
        data: new Quiver({ data: NAMED_INDEX }),
      }

      const { container } = render(<ArrowTable {...props} />)

      // NAMED_INDEX has 1 index column (hidden) + 2 data columns = 2 visible columns
      const headerRow = container.querySelector("thead tr")
      expect(headerRow).toBeTruthy()
      const headerCells = headerRow?.querySelectorAll("th")
      expect(headerCells?.length).toBe(2)

      // First header should be "c1" (first data column), not "INDEX"
      const firstHeader = headerCells?.[0]
      expect(firstHeader?.textContent).not.toContain("INDEX")
      expect(firstHeader?.textContent).toContain("c1")

      // Check data rows also have only 2 columns
      const dataRow = container.querySelector("tbody tr")
      expect(dataRow).toBeTruthy()
      const dataCells = dataRow?.querySelectorAll("th, td")
      expect(dataCells?.length).toBe(2)

      // First cell should be a td (data column), not th (index column)
      const firstDataCell = dataCells?.[0]
      expect(firstDataCell?.tagName).toBe("TD")
    })

    it("shows index columns when explicitly set to visible", () => {
      const columnConfig = JSON.stringify({
        [INDEX_IDENTIFIER]: { hidden: false },
      })

      const props: TableProps = {
        element: ArrowProto.create({
          borderMode: ArrowProto.BorderMode.ALL,
          columns: columnConfig,
        }),
        data: new Quiver({ data: NAMED_INDEX }),
      }

      const { container } = render(<ArrowTable {...props} />)

      // NAMED_INDEX has 1 index column + 2 data columns = 3 total columns
      const headerRow = container.querySelector("thead tr")
      expect(headerRow).toBeTruthy()
      const headerCells = headerRow?.querySelectorAll("th")
      expect(headerCells?.length).toBe(3)

      // Check that the first header is the index column (named "INDEX")
      const firstHeader = headerCells?.[0]
      expect(firstHeader?.textContent).toContain("INDEX")
    })

    it("handles empty table with hidden index configuration", () => {
      const columnConfig = JSON.stringify({
        [INDEX_IDENTIFIER]: { hidden: true },
      })

      const props: TableProps = {
        element: ArrowProto.create({
          borderMode: ArrowProto.BorderMode.ALL,
          columns: columnConfig,
        }),
        data: new Quiver({ data: EMPTY }),
      }

      render(<ArrowTable {...props} />)

      // Empty table should still render with "empty" cell
      expect(
        screen.getByTestId("stTableStyledEmptyTableCell")
      ).toBeInTheDocument()
    })
  })
})
