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

import { Table as TableProto } from "@streamlit/protobuf"

import { EMPTY } from "~lib/mocks/arrow/empty"
import { MULTI } from "~lib/mocks/arrow/multi"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"
import { render } from "~lib/test_util"

import { Table, TableProps } from "./Table"

const getProps = (data: Uint8Array): TableProps => ({
  element: TableProto.create({
    borderMode: TableProto.BorderMode.ALL,
    arrowData: { data },
  }),
  elementHash: "test-hash",
})

describe("st.table", () => {
  it("renders without crashing", () => {
    const props = getProps(UNICODE)
    render(<Table {...props} />)
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
    render(<Table {...props} />)

    expect(screen.getByTestId("stTable")).toBeInTheDocument()
    expect(screen.getByTestId("stTableStyledTable")).toBeInTheDocument()
    expect(
      screen.getByTestId("stTableStyledEmptyTableCell")
    ).toBeInTheDocument()
  })

  it("renders with all borders when border=true", () => {
    const modifiedProps: TableProps = {
      element: TableProto.create({
        borderMode: TableProto.BorderMode.ALL,
        arrowData: { data: UNICODE },
      }),
      elementHash: "test-hash",
    }

    const { container } = render(<Table {...modifiedProps} />)

    // Check that the table border wrapper has border styling
    const tableBorder = container.querySelector(
      '[data-testid="stTable"] > div'
    ) as HTMLElement
    expect(tableBorder).toBeTruthy()
    const borderStyle = getComputedStyle(tableBorder)
    expect(borderStyle.borderStyle).toBe("solid")
  })

  it("renders without borders when border=false", () => {
    const modifiedProps: TableProps = {
      element: TableProto.create({
        borderMode: TableProto.BorderMode.NONE,
        arrowData: { data: UNICODE },
      }),
      elementHash: "test-hash",
    }

    const { container } = render(<Table {...modifiedProps} />)

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
      element: TableProto.create({
        borderMode: TableProto.BorderMode.HORIZONTAL,
        arrowData: { data: UNICODE },
      }),
      elementHash: "test-hash",
    }

    const { container } = render(<Table {...modifiedProps} />)

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

  it("does not truncate cell content by default", () => {
    const props = getProps(UNICODE)
    const { container } = render(<Table {...props} />)

    const markdownContainer = container.querySelector(
      '[data-testid="stMarkdownContainer"]'
    ) as HTMLElement
    const markdownStyle = getComputedStyle(markdownContainer)
    expect(markdownStyle.display).toBe("inline-block")
    expect(markdownStyle.whiteSpace).toBe("normal")
    expect(markdownStyle.maxWidth).not.toBe("none")

    const tableCell = container.querySelector("td") as HTMLElement
    const cellStyle = getComputedStyle(tableCell)
    expect(cellStyle.whiteSpace).toBe("nowrap")
    expect(cellStyle.textOverflow).not.toBe("ellipsis")
  })

  it("truncates cell content for fixed pixel width", () => {
    const props: TableProps = {
      ...getProps(UNICODE),
      widthConfig: {
        pixelWidth: 300,
      },
    }

    const { container } = render(<Table {...props} />)

    const markdownContainer = container.querySelector(
      '[data-testid="stMarkdownContainer"]'
    ) as HTMLElement
    const markdownStyle = getComputedStyle(markdownContainer)
    expect(markdownStyle.display).not.toBe("inline-block")

    const tableCell = container.querySelector("td") as HTMLElement
    const cellStyle = getComputedStyle(tableCell)
    expect(cellStyle.whiteSpace).toBe("nowrap")
    expect(cellStyle.textOverflow).toBe("ellipsis")
  })

  it("uses non-overlapping sticky offsets for multi-row headers", () => {
    const props: TableProps = {
      ...getProps(MULTI),
      widthConfig: {
        pixelWidth: 360,
      },
      heightConfig: {
        pixelHeight: 240,
      },
    }

    const { container } = render(<Table {...props} />)

    const headerRows = container.querySelectorAll("thead tr")
    expect(headerRows.length).toBeGreaterThan(1)

    const firstHeaderCell = headerRows[0].querySelector("th") as HTMLElement
    const secondHeaderCell = headerRows[1].querySelector("th") as HTMLElement

    const firstHeaderTop = getComputedStyle(firstHeaderCell).top
    const secondHeaderTop = getComputedStyle(secondHeaderCell).top
    expect(firstHeaderTop).toBe("0px")
    expect(secondHeaderTop).not.toBe(firstHeaderTop)

    // Multi-index columns should NOT have sticky positioning
    // (sticky index is only enabled for single-index tables to avoid complex offset calculations)
    const firstRowIndexCells = container.querySelectorAll(
      "tbody tr:first-child th[scope='row']"
    )
    expect(firstRowIndexCells.length).toBeGreaterThan(1)

    const firstIndexLeft = getComputedStyle(firstRowIndexCells[0]).left
    // Empty string means no sticky left positioning was applied
    expect(firstIndexLeft).toBe("")
  })

  it("adds a11y attributes to scrollable tables", () => {
    const props: TableProps = {
      ...getProps(UNICODE),
      widthConfig: {
        pixelWidth: 300,
      },
      heightConfig: {
        pixelHeight: 200,
      },
    }

    const { container } = render(<Table {...props} />)

    const scrollableWrapper = container.querySelector(
      '[data-testid="stTable"] > div'
    ) as HTMLElement
    expect(scrollableWrapper).toHaveAttribute("role", "region")
    expect(scrollableWrapper).toHaveAttribute("tabindex", "0")
    expect(scrollableWrapper).toHaveAttribute("aria-label", "Scrollable table")
  })

  it("does not add a11y attributes to non-scrollable tables", () => {
    const props = getProps(UNICODE)

    const { container } = render(<Table {...props} />)

    const wrapper = container.querySelector(
      '[data-testid="stTable"] > div'
    ) as HTMLElement
    expect(wrapper).not.toHaveAttribute("role")
    expect(wrapper).not.toHaveAttribute("tabindex")
    expect(wrapper).not.toHaveAttribute("aria-label")
  })

  it("hides index columns when hideIndex is true", () => {
    const props: TableProps = {
      element: TableProto.create({
        borderMode: TableProto.BorderMode.ALL,
        hideIndex: true,
        arrowData: { data: UNICODE },
      }),
      elementHash: "test-hash",
    }

    const { container } = render(<Table {...props} />)

    // Index cells use th[scope='row'], they should not be present
    const indexCells = container.querySelectorAll("th[scope='row']")
    expect(indexCells.length).toBe(0)

    // Data cells should still be present
    const dataCells = container.querySelectorAll("td")
    expect(dataCells.length).toBeGreaterThan(0)
  })

  it("shows index columns when hideIndex is false", () => {
    const props: TableProps = {
      element: TableProto.create({
        borderMode: TableProto.BorderMode.ALL,
        hideIndex: false,
        arrowData: { data: UNICODE },
      }),
      elementHash: "test-hash",
    }

    const { container } = render(<Table {...props} />)

    // Index cells should be present
    const indexCells = container.querySelectorAll("th[scope='row']")
    expect(indexCells.length).toBeGreaterThan(0)
  })

  it("hides header row when hideHeader is true", () => {
    const props: TableProps = {
      element: TableProto.create({
        borderMode: TableProto.BorderMode.ALL,
        hideHeader: true,
        arrowData: { data: UNICODE },
      }),
      elementHash: "test-hash",
    }

    const { container } = render(<Table {...props} />)

    // thead should not be present
    const thead = container.querySelector("thead")
    expect(thead).not.toBeInTheDocument()

    // tbody should still be present with data
    const tbody = container.querySelector("tbody")
    expect(tbody).toBeInTheDocument()
    const dataCells = container.querySelectorAll("td")
    expect(dataCells.length).toBeGreaterThan(0)
  })

  it("shows header row when hideHeader is false", () => {
    const props: TableProps = {
      element: TableProto.create({
        borderMode: TableProto.BorderMode.ALL,
        hideHeader: false,
        arrowData: { data: UNICODE },
      }),
      elementHash: "test-hash",
    }

    const { container } = render(<Table {...props} />)

    // thead should be present
    const thead = container.querySelector("thead")
    expect(thead).toBeInTheDocument()

    // Header cells should be present
    const headerCells = container.querySelectorAll("th[scope='col']")
    expect(headerCells.length).toBeGreaterThan(0)
  })
})
