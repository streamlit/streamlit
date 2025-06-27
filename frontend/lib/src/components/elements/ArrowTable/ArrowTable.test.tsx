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

import { render } from "~lib/test_util"
import { EMPTY, UNICODE } from "~lib/mocks/arrow"
import { Quiver } from "~lib/dataframes/Quiver"

import { ArrowTable, TableProps } from "./ArrowTable"

const getProps = (data: Uint8Array): TableProps => ({
  element: new Quiver({ data }),
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

  it("renders without borders when border=false", () => {
    // Create a Quiver with border=false
    const props = getProps(UNICODE)
    const mockQuiver = new Quiver({ data: UNICODE, border: false })
    const modifiedProps = { element: mockQuiver }

    const { container } = render(<ArrowTable {...modifiedProps} />)

    // Check that the table border wrapper has no border styling
    const tableBorder = container.querySelector(
      '[data-testid="stTable"] > div'
    )
    expect(tableBorder).toHaveStyle("border: none")
  })
})
