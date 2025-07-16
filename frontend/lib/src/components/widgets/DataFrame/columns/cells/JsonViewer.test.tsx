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

import { JsonViewer } from "./JsonViewer"

const mockTheme = {
  cellHorizontalPadding: 8,
  bgCell: "#ffffff",
  fontFamily: "Arial",
  baseFontStyle: "14px",
}

describe("JsonViewer", () => {
  it("renders valid JSON object correctly", () => {
    const jsonObject = { name: "test", value: 123 }
    render(<JsonViewer jsonValue={jsonObject} theme={mockTheme} />)

    // Check that the json viewer is used:
    const reactJsonView = screen.getByTestId("stJsonColumnViewer")
    expect(reactJsonView).toBeInTheDocument()

    // ReactJson component should be rendered
    expect(screen.getByText(/name/)).toBeInTheDocument()
    expect(screen.getByText(/test/)).toBeInTheDocument()
  })

  it("renders valid JSON string correctly", () => {
    const jsonString = '{"name": "test", "value": 123}'
    render(<JsonViewer jsonValue={jsonString} theme={mockTheme} />)

    // Check that the json viewer is used:
    const reactJsonView = screen.getByTestId("stJsonColumnViewer")
    expect(reactJsonView).toBeInTheDocument()

    // ReactJson component should be rendered
    expect(screen.getByText(/name/)).toBeInTheDocument()
    expect(screen.getByText(/test/)).toBeInTheDocument()
  })

  it("renders invalid JSON as text", () => {
    const invalidJson = "{invalid json}"
    render(<JsonViewer jsonValue={invalidJson} theme={mockTheme} />)

    // Check that the json viewer is not used:
    const reactJsonView = screen.queryByTestId("stJsonColumnViewer")
    expect(reactJsonView).not.toBeInTheDocument()

    // TextCellEntry should be rendered with the raw string
    const textInput = screen.getByDisplayValue("{invalid json}")
    expect(textInput).toBeInTheDocument()
    expect(textInput).toBeDisabled()
  })

  it("renders null value as empty string", () => {
    render(<JsonViewer jsonValue={null} theme={mockTheme} />)

    // Check that the json viewer is not used:
    const reactJsonView = screen.queryByTestId("stJsonColumnViewer")
    expect(reactJsonView).not.toBeInTheDocument()

    // TextCellEntry should be rendered with an empty string
    const textInput = screen.getByDisplayValue("")
    expect(textInput).toBeInTheDocument()
    expect(textInput).toBeDisabled()
  })

  it("renders undefined value as empty string", () => {
    render(<JsonViewer jsonValue={undefined} theme={mockTheme} />)

    // Check that the json viewer is not used:
    const reactJsonView = screen.queryByTestId("stJsonColumnViewer")
    expect(reactJsonView).not.toBeInTheDocument()

    // TextCellEntry should be rendered with an empty string
    const textInput = screen.getByDisplayValue("")
    expect(textInput).toBeInTheDocument()
    expect(textInput).toBeDisabled()
  })
})
