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
  exceedsLineLimit,
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

    // The boundary is pinned on the pure helper rather than through renders, which
    // keeps it exact and cheap: highlighting ~50k lines was the most expensive thing
    // in this file and had to fit vitest's per-test budget on the slowest runner.
    // Note a trailing newline still counts as a line, matching the highlighter's own
    // row count.
    it.each([
      ["a\nb", 2, false],
      ["a\nb\n", 2, true],
      ["", 1, false],
      ["a", 1, false],
    ])("exceedsLineLimit(%j, %i) === %s", (text, limit, expected) => {
      expect(exceedsLineLimit(text, limit)).toBe(expected)
    })

    it("highlights ordinary input", () => {
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(10),
        language: "python",
      })
      const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

      // Assert highlighting actually ran, not just that the fallback is absent --
      // otherwise this would still pass if the highlighted branch were replaced by
      // plain markup. The highlighter sets `language-<lang>` on the code element
      // regardless of whether the content produces any tokens, which this prose
      // fixture does not.
      expect(
        baseElement.querySelector("pre code.language-python")
      ).toBeVisible()
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
      expect(fallback).toBeVisible()
      expect(fallback.tagName.toLowerCase()).toBe("code")
      // The content is still all there, just not tokenized.
      expect(fallback.textContent).toHaveLength(
        line.length * (MAX_HIGHLIGHTED_LINES + 1)
      )
      expect(fallback.querySelector(".token")).not.toBeInTheDocument()
    })

    it("renders 200k lines without overflowing the stack", () => {
      // Regression for #11996: without the guard the highlighter throws
      // "Maximum call stack size exceeded" and the code block does not render.
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(200000),
        language: "python",
      })

      expect(() =>
        render(<StreamlitSyntaxHighlighter {...props} />)
      ).not.toThrow()
      expect(screen.getByTestId("stCodeUnhighlighted")).toBeVisible()
    })

    it("still highlights a large byte count spread over few lines", () => {
      // Line count, not byte size, is what overflows the stack: 5MB over 5k lines
      // stays far below the line cap and must still be highlighted.
      const props = getStreamlitSyntaxHighlighterProps({
        children: ("x".repeat(999) + "\n").repeat(5000),
        language: "python",
      })
      const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

      expect(
        baseElement.querySelector("pre code.language-python")
      ).toBeVisible()
      expect(
        screen.queryByTestId("stCodeUnhighlighted")
      ).not.toBeInTheDocument()
    })

    it("applies the cap on the wrapLines path too", () => {
      // wrapLines: true cannot throw -- processLines returns newTree without the
      // concat spread -- but highlighting this many lines still pins the main
      // thread, so the cap is deliberately not conditional on it.
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(MAX_HIGHLIGHTED_LINES + 1),
        language: "python",
        wrapLines: true,
      })
      const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

      const fallback = screen.getByTestId("stCodeUnhighlighted")
      expect(fallback).toBeVisible()
      // The fallback is a StyledCode carrying wrapLines, so wrapping still works
      // when highlighting is skipped.
      expect(fallback).toHaveStyle({ whiteSpace: "pre-wrap" })
      expect(
        baseElement.querySelector("pre code.language-python")
      ).not.toBeInTheDocument()
    })

    it("keeps the copy button available in the fallback", () => {
      const props = getStreamlitSyntaxHighlighterProps({
        children: line.repeat(MAX_HIGHLIGHTED_LINES + 1),
      })
      render(<StreamlitSyntaxHighlighter {...props} />)

      expect(screen.getByTestId("stCodeUnhighlighted")).toBeVisible()
      // The toolbar button is revealed on hover, so assert presence rather than
      // visibility -- matching the existing non-fallback toolbar test above.
      expect(
        screen.getByTestId("stBaseButton-elementToolbar")
      ).toBeInTheDocument()
      expect(screen.getByTestId("stCode")).toHaveAttribute("tabindex", "0")
    })
  })
})
