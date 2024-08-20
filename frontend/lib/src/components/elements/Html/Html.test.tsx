/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import { Html as HtmlProto } from "@streamlit/lib/src/proto"

import Html, { HtmlProps } from "./Html"

const getProps = (elementProps: Partial<HtmlProto> = {}): HtmlProps => ({
  element: HtmlProto.create({
    body: "<div>Test Html</div>",
    ...elementProps,
  }),
  width: 100,
})

describe("HTML element", () => {
  it("renders the element as expected", () => {
    const props = getProps()
    render(<Html {...props} />)
    const html = screen.getByTestId("stHtml")
    expect(html).toBeInTheDocument()
    expect(html).toHaveTextContent("Test Html")
    expect(html).toHaveStyle("width: 100px")
    expect(html).toHaveClass("stHtml")
  })

  it("handles <style> tags - applies style", () => {
    const props = getProps({
      body: `
        <style>
            #random { color: orange; }
        </style>
        <div id="random">Test Html</div>
    `,
    })
    render(<Html {...props} />)
    const html = screen.getByTestId("stHtml")
    expect(html).toHaveTextContent("Test Html")
    // Check that the style tag is applied to the div
    expect(screen.getByText("Test Html")).toHaveStyle("color: orange")
    // Check that the unnecessary spacing handling by hiding parent
    // eslint-disable-next-line testing-library/no-node-access
    expect(html.parentElement).toHaveClass("stHtml-empty")
  })

  it("sanitizes <script> tags", () => {
    const props = getProps({
      body: `<script> alert('BEWARE - the script tag is scripting'); </script>`,
    })
    render(<Html {...props} />)
    expect(screen.queryByTestId("stHtml")).not.toBeInTheDocument()
  })

  it("sanitizes <svg> tags", () => {
    const props = getProps({
      body: `
        <svg width="100" height="100">
            <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
        </svg>
    `,
    })
    render(<Html {...props} />)
    expect(screen.getByTestId("stHtml")).toHaveTextContent("")
  })
})
