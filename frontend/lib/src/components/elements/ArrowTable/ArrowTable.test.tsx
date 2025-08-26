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

import React from "react"

import { screen } from "@testing-library/react"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"
import { EMPTY, UNICODE } from "~lib/mocks/arrow"
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
    )
    if (tableBorder) {
      const borderStyle = getComputedStyle(tableBorder)
      expect(borderStyle.borderStyle).toBe("solid")
    }
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
    const tableCell = container.querySelector("td")
    if (tableCell) {
      const cellStyle = getComputedStyle(tableCell)
      expect(cellStyle.borderBottomStyle).toBe("solid")
    }
  })
})
