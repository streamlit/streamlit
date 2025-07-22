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

import FileDropzone, { Props } from "./FileDropzone"
import { STREAMLIT_MIME_TYPE } from "./utils"

const getProps = (props: Partial<Props> = {}): Props => ({
  disabled: false,
  label: "LABEL",
  onDrop: vi.fn(),
  multiple: true,
  acceptedExtensions: [],
  maxSizeBytes: 200,
  ...props,
})

describe("FileDropzone widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<FileDropzone {...props} />)

    expect(screen.getByTestId("stFileUploaderDropzone")).toBeInTheDocument()
  })

  it("renders dropzone without extensions", () => {
    const props = getProps({
      acceptedExtensions: [],
    })
    render(<FileDropzone {...props} />)
    expect(
      screen.queryByTestId("stFileUploaderDropzoneInput")
    ).not.toHaveAttribute("accept")
  })

  it("renders dropzone with extensions", () => {
    const props = getProps({
      acceptedExtensions: [".jpg"],
    })
    render(<FileDropzone {...props} />)
    expect(
      screen.queryByTestId("stFileUploaderDropzoneInput")
    ).toHaveAttribute("accept", [STREAMLIT_MIME_TYPE, ".jpg"].join(","))
  })
})
