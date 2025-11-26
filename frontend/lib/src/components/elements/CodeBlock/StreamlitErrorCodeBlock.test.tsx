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

import StreamlitErrorCodeBlock, {
  StreamlitErrorCodeBlockProps,
} from "./StreamlitErrorCodeBlock"

// Realistic Python exception traceback example
const EXCEPTION_TRACEBACK = `Traceback (most recent call last):
  File "/app/streamlit_app.py", line 45, in <module>
    result = divide_numbers(10, 0)
  File "/app/streamlit_app.py", line 12, in divide_numbers
    return a / b
ZeroDivisionError: division by zero`

const getStreamlitCodeBlockProps = (
  props: Partial<StreamlitErrorCodeBlockProps> = {}
): StreamlitErrorCodeBlockProps => ({
  children: EXCEPTION_TRACEBACK,
  ...props,
})

describe("StreamlitErrorCodeBlock", () => {
  it("should render without crashing", () => {
    const props = getStreamlitCodeBlockProps()
    render(<StreamlitErrorCodeBlock {...props} />)

    const codeBlock = screen.getByTestId("stErrorCodeBlock")
    expect(codeBlock).toBeVisible()
  })

  it("should render the error code block with correct class", () => {
    const props = getStreamlitCodeBlockProps()
    render(<StreamlitErrorCodeBlock {...props} />)

    const codeBlock = screen.getByTestId("stErrorCodeBlock")
    expect(codeBlock).toHaveClass("stErrorCodeBlock")
  })

  it("should render copy button when children is a non-empty string", () => {
    const props = getStreamlitCodeBlockProps()
    render(<StreamlitErrorCodeBlock {...props} />)

    // Copy button exists in DOM but is hidden by default (scale(0))
    // and only becomes visible on hover
    const copyButton = screen.getByTestId("stCodeCopyButton")
    expect(copyButton).toBeInTheDocument()
  })

  it.each([
    { label: "empty string", value: "" },
    { label: "only whitespace", value: "   \n\t  " },
    { label: "array", value: ["Line 1\n", "Line 2\n"] },
  ])("should not render copy button when children is $label", ({ value }) => {
    const props = getStreamlitCodeBlockProps({ children: value })
    render(<StreamlitErrorCodeBlock {...props} />)

    const copyButton = screen.queryByTestId("stCodeCopyButton")
    expect(copyButton).not.toBeInTheDocument()
  })

  it("should render exception text content correctly", () => {
    const props = getStreamlitCodeBlockProps()
    const { baseElement } = render(<StreamlitErrorCodeBlock {...props} />)

    const pre = baseElement.querySelector("pre")
    expect(pre?.textContent).toContain("ZeroDivisionError: division by zero")
    expect(pre?.textContent).toContain("Traceback (most recent call last)")
  })

  it("should render array children correctly", () => {
    const arrayChildren = [
      "Traceback (most recent call last):\n",
      '  File "app.py", line 10, in <module>\n',
      "    raise ValueError('Invalid input')\n",
      "ValueError: Invalid input",
    ]
    const props = getStreamlitCodeBlockProps({ children: arrayChildren })
    const { baseElement } = render(<StreamlitErrorCodeBlock {...props} />)

    const pre = baseElement.querySelector("pre")
    arrayChildren.forEach(line => {
      expect(pre?.textContent).toContain(line.trim())
    })
  })
})
