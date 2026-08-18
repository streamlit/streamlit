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

import { screen, within } from "@testing-library/react"

import { render } from "~lib/test_util"

import StreamlitSyntaxHighlighter, {
  MAX_HIGHLIGHTED_LINES,
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

  it("renders copy action in toolbar for non-empty code", () => {
    const props = getStreamlitSyntaxHighlighterProps()
    render(<StreamlitSyntaxHighlighter {...props} />)
    const codeBlock = screen.getByTestId("stCode")

    expect(codeBlock).toHaveAttribute("tabindex", "0")
    expect(
      screen.getByTestId("stBaseButton-elementToolbar")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /copy to clipboard/i })
    ).not.toBeInTheDocument()
  })

  it.each([null, undefined, "", "   \n\t  "])(
    "does not render copy action for empty code value '%s'",
    children => {
      const props = getStreamlitSyntaxHighlighterProps({ children })
      render(<StreamlitSyntaxHighlighter {...props} />)

      expect(screen.getByTestId("stCode")).not.toHaveAttribute("tabindex")
      expect(
        screen.queryByRole("button", { name: /copy to clipboard/i })
      ).not.toBeInTheDocument()
    }
  )

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

  it("renders python with line numbers and wrapped rows when showLineNumbers and wrapLines are true", () => {
    const props = getStreamlitSyntaxHighlighterProps({
      language: "python",
      showLineNumbers: true,
      wrapLines: true,
    })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

    const codeBlock = screen.getByTestId("stCode")
    for (const lineNo of [1, 2, 3, 4]) {
      expect(
        within(codeBlock).getByText(String(lineNo), {
          selector: ".linenumber",
        })
      ).toBeVisible()
    }
    expect(within(codeBlock).getByText("import")).toBeVisible()
    expect(
      within(codeBlock).getByText('"Hello"', { selector: ".token.string" })
    ).toBeVisible()

    const codeEl = baseElement.querySelector("pre code")
    expect(codeEl).toBeInTheDocument()
    const lineRows = codeEl?.querySelectorAll(":scope > span") ?? []
    expect(lineRows).toHaveLength(4)
    for (const row of lineRows) {
      expect(row.querySelector(".linenumber")).toBeInTheDocument()
      expect(row.querySelector(":scope > span")).toBeInTheDocument()
    }
  })
  describe("very long input", () => {
    const line = "lorem ipsum dolor sit amet\n"

    it("highlights normally at the line limit", () => {
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(MAX_HIGHLIGHTED_LINES - 1),
        language: "python",
      })
      render(<StreamlitSyntaxHighlighter {...props} />)

      expect(
        screen.queryByTestId("stCodeUnhighlighted")
      ).not.toBeInTheDocument()
    })

    it("falls back to unhighlighted code past the line limit", () => {
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(MAX_HIGHLIGHTED_LINES + 1),
        language: "python",
      })
      render(<StreamlitSyntaxHighlighter {...props} />)

      const fallback = screen.getByTestId("stCodeUnhighlighted")
      expect(fallback).toBeInTheDocument()
      expect(fallback.tagName.toLowerCase()).toBe("code")
      // The content is still all there, just not tokenized.
      expect(fallback.textContent).toHaveLength(
        line.length * (MAX_HIGHLIGHTED_LINES + 1)
      )
      expect(fallback.querySelector(".token")).not.toBeInTheDocument()
    })

    it("renders 200k lines without overflowing the stack", () => {
      // The regression from #11996. Highlighting recurses once per line, so this
      // input threw "Maximum call stack size exceeded" before the guard existed
      // and no code block rendered at all.
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(200000),
        language: "python",
      })

      expect(() =>
        render(<StreamlitSyntaxHighlighter {...props} />)
      ).not.toThrow()
      expect(screen.getByTestId("stCodeUnhighlighted")).toBeInTheDocument()
    })

    it("still highlights a large byte count spread over few lines", () => {
      // Byte size is not what overflows the stack -- line count is. 20MB across
      // 20k lines must keep its highlighting.
      const props = getStreamlitSyntaxHighlighterProps({
        children: ("x".repeat(999) + "\n").repeat(20000),
        language: "python",
      })
      render(<StreamlitSyntaxHighlighter {...props} />)

      expect(
        screen.queryByTestId("stCodeUnhighlighted")
      ).not.toBeInTheDocument()
    })

    it("keeps the copy button available in the fallback", () => {
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(MAX_HIGHLIGHTED_LINES + 1),
      })
      render(<StreamlitSyntaxHighlighter {...props} />)

      expect(screen.getByTestId("stCodeUnhighlighted")).toBeInTheDocument()
      expect(
        screen.getByTestId("stBaseButton-elementToolbar")
      ).toBeInTheDocument()
      expect(screen.getByTestId("stCode")).toHaveAttribute("tabindex", "0")
    })
  })
})
