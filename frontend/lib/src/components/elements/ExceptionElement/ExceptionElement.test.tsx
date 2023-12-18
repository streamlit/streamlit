/**
 * Copyright (c) Streamlit Inc. (2018-2024) Snowflake Inc. (2022-2024)
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
import { render } from "@streamlit/lib/src/test_util"
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { Exception as ExceptionProto } from "@streamlit/lib/src/proto"

import ExceptionElement, { ExceptionElementProps } from "./ExceptionElement"

const getProps = (
  elementProps: Partial<ExceptionProto> = {}
): ExceptionElementProps => ({
  element: ExceptionProto.create({
    stackTrace: ["step 1", "step 2", "step 3"],
    type: "RuntimeError",
    message: "This is an exception of type RuntimeError",
    messageIsMarkdown: false,
    ...elementProps,
  }),
  width: 0,
})

describe("ExceptionElement Element", () => {
  it("renders without crashing", () => {
    render(<ExceptionElement {...getProps()} />)

    const exceptionContainer = screen.getByTestId("stException")
    expect(exceptionContainer).toBeInTheDocument()
  })

  it("should render the complete stack", () => {
    render(<ExceptionElement {...getProps()} />)

    expect(screen.getByText("Traceback:")).toBeInTheDocument()

    const traceRows = screen.getAllByTestId("stExceptionTraceRow")
    traceRows.forEach((row, index) => {
      expect(row).toHaveTextContent(`step ${index + 1}`)
    })
  })

  it("should render markdown when it has messageIsMarkdown", () => {
    render(<ExceptionElement {...getProps({ messageIsMarkdown: true })} />)

    expect(screen.getByTestId("stMarkdownContainer")).toBeInTheDocument()
  })

  it("should render if there's no message", () => {
    render(<ExceptionElement {...getProps({ message: "" })} />)

    expect(screen.getByText("RuntimeError")).toBeInTheDocument()
  })
})
