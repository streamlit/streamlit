/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"

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
      screen.getByTestId("stFileDropzoneInstructions")
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
})
