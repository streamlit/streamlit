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

import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import StreamlitSyntaxHighlighter, {
  StreamlitSyntaxHighlighterProps,
} from "./StreamlitSyntaxHighlighter"

const getStreamlitSyntaxHighlighterProps = (
  props: Partial<StreamlitSyntaxHighlighterProps> = {}
): StreamlitSyntaxHighlighterProps => ({
  children: [
    `import streamlit as st

st.write("Hello")
`,
  ],
  ...props,
})

describe("CustomCodeTag Element", () => {
  it("should render without crashing", () => {
    const props = getStreamlitSyntaxHighlighterProps()
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

    expect(baseElement.querySelectorAll("pre code")).toHaveLength(1)
  })

  it("should render as plaintext", () => {
    const props = getStreamlitSyntaxHighlighterProps({ language: "plaintext" })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

    expect(baseElement.querySelector("pre code")?.outerHTML).toBe(
      '<code class="language-plaintext" style="white-space: pre;"><span>import streamlit as st\n' +
        "</span>\n" +
        'st.write("Hello")\n' +
        "</code>"
    )
  })

  it("should render as plaintext if no language specified", () => {
    const props = getStreamlitSyntaxHighlighterProps({ language: "plaintext" })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

    expect(baseElement.querySelector("pre code")?.outerHTML).toBe(
      '<code class="language-plaintext" style="white-space: pre;"><span>import streamlit as st\n' +
        "</span>\n" +
        'st.write("Hello")\n' +
        "</code>"
    )
  })

  it("should render as python", () => {
    const props = getStreamlitSyntaxHighlighterProps({ language: "python" })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)
    expect(
      baseElement.querySelector("pre code .token.string")?.innerHTML
    ).toBe('"Hello"')
  })

  it.each([
    [null, ""],
    [undefined, ""],
    ["null", "null"],
    ["undefined", "undefined"],
  ])("renders children '%s' as '%s'", (children, expected) => {
    const props = getStreamlitSyntaxHighlighterProps({ children })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)
    expect(baseElement.querySelector("pre code")).toHaveTextContent(expected)
  })

  it("should render copy button for non-empty code", () => {
    const props = getStreamlitSyntaxHighlighterProps()
    render(<StreamlitSyntaxHighlighter {...props} />)

    // Use queryByTestId (returns null instead of throwing) so the
    // toBeInTheDocument assertion is meaningful, not redundant.
    const copyButton = screen.queryByTestId("stCodeCopyButton")
    expect(copyButton).toBeInTheDocument()
  })

  it("should not render copy button for empty code", () => {
    const props = getStreamlitSyntaxHighlighterProps({ children: "" })
    render(<StreamlitSyntaxHighlighter {...props} />)

    const copyButton = screen.queryByTestId("stCodeCopyButton")
    expect(copyButton).not.toBeInTheDocument()
  })

  it("should reserve space for the copy button via paddingRight on the code block", () => {
    const longCode =
      "x = " +
      "'a very long string that extends well beyond the viewport width'".repeat(
        5
      )
    const props = getStreamlitSyntaxHighlighterProps({ children: longCode })
    render(<StreamlitSyntaxHighlighter {...props} />)

    const codeBlock = screen.getByTestId("stCode")
    // The code block should reserve space for the copy button so it
    // doesn't overlap scrolled code, and clip overflowing content.
    expect(codeBlock).toHaveStyle(
      `padding-right: ${mockTheme.emotion.iconSizes.threeXL}`
    )
    expect(codeBlock).toHaveStyle("overflow: hidden")
  })
})
