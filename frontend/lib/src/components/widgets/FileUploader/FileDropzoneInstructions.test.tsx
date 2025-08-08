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

import FileDropzoneInstructions, { Props } from "./FileDropzoneInstructions"

const getProps = (props: Partial<Props> = {}): Props => ({
  multiple: true,
  acceptedExtensions: [],
  maxSizeBytes: 2000,
  ...props,
})

describe("FileDropzoneInstructions widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<FileDropzoneInstructions {...props} />)

    expect(
      screen.getByTestId("stFileUploaderDropzoneInstructions")
    ).toBeInTheDocument()
  })

  it("shows file size limit", () => {
    const props = getProps({ maxSizeBytes: 2000 })
    render(<FileDropzoneInstructions {...props} />)

    expect(screen.getByText("Limit 2KB per file")).toBeInTheDocument()
  })

  it("renders without extensions", () => {
    const props = getProps({
      acceptedExtensions: [],
    })
    render(<FileDropzoneInstructions {...props} />)
    expect(screen.getByText(/per file$/)).toBeInTheDocument()
  })

  it("renders with extensions", () => {
    const props = getProps({
      acceptedExtensions: ["jpg", "csv.gz", ".png", ".tar.gz"],
    })
    render(<FileDropzoneInstructions {...props} />)
    expect(screen.getByText(/• JPG, CSV.GZ, PNG, TAR.GZ/)).toBeInTheDocument()
  })

  it("shows directory upload instructions", () => {
    const props = getProps({
      acceptDirectory: true,
    })
    render(<FileDropzoneInstructions {...props} />)

    const container = screen.getByTestId("stFileUploaderDropzoneInstructions")
    expect(container).toHaveTextContent("Drag and drop directories here")
  })

  it("shows regular file upload instructions", () => {
    const props = getProps({
      acceptDirectory: false,
    })
    render(<FileDropzoneInstructions {...props} />)

    const container = screen.getByTestId("stFileUploaderDropzoneInstructions")
    expect(container).toHaveTextContent("Drag and drop files here")
  })

  it("shows directory upload instructions with multiple true", () => {
    const props = getProps({
      acceptDirectory: true,
      multiple: true,
    })
    render(<FileDropzoneInstructions {...props} />)

    // Directory mode shows directory instructions regardless of multiple flag
    const container = screen.getByTestId("stFileUploaderDropzoneInstructions")
    expect(container).toHaveTextContent("Drag and drop directories here")
  })

  it("shows file type restrictions with directory upload", () => {
    const props = getProps({
      acceptDirectory: true,
      acceptedExtensions: ["txt", "py"],
    })
    render(<FileDropzoneInstructions {...props} />)

    expect(screen.getByText(/• TXT, PY/)).toBeVisible()
  })

  it("shows size limit with directory upload", () => {
    const props = getProps({
      acceptDirectory: true,
      maxSizeBytes: 5000,
    })
    render(<FileDropzoneInstructions {...props} />)

    expect(screen.getByText("Limit 5KB per file")).toBeVisible()
  })
})
