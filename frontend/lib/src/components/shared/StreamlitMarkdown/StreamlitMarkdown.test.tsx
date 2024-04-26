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

import React, { ReactElement } from "react"
import "@testing-library/jest-dom"
import ReactMarkdown from "react-markdown"
import { screen, cleanup } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"
import IsSidebarContext from "@streamlit/lib/src/components/core/IsSidebarContext"
import { colors } from "@streamlit/lib/src/theme/primitives/colors"
import { transparentize } from "color2k"

import StreamlitMarkdown, {
  LinkWithTargetBlank,
  createAnchorFromText,
  CustomCodeTag,
  CustomCodeTagProps,
} from "./StreamlitMarkdown"
import IsDialogContext from "src/components/core/IsDialogContext"

// Fixture Generator
const getMarkdownElement = (body: string): ReactElement => {
  const components = {
    a: LinkWithTargetBlank,
  }
  return <ReactMarkdown components={components}>{body}</ReactMarkdown>
}

describe("createAnchorFromText", () => {
  it("generates slugs correctly", () => {
    const cases = [
      ["some header", "some-header"],
      ["some -24$35-9824  header", "some-24-35-9824-header"],
      ["blah___blah___blah", "blah-blah-blah"],
    ]

    cases.forEach(([s, want]) => {
      expect(createAnchorFromText(s)).toEqual(want)
    })
  })
})

describe("linkReference", () => {
  it("renders a link with _blank target", () => {
    const body = "Some random URL like [Streamlit](https://streamlit.io/)"
    render(getMarkdownElement(body))
    expect(screen.getByText("Streamlit")).toHaveAttribute(
      "href",
      "https://streamlit.io/"
    )
    expect(screen.getByText("Streamlit")).toHaveAttribute("target", "_blank")
  })

  it("renders a link without title", () => {
    const body =
      "Everybody loves [The Internet Archive](https://archive.org/)."
    render(getMarkdownElement(body))
    const link = screen.getByText("The Internet Archive")
    expect(link).toHaveAttribute("href", "https://archive.org/")
    expect(link).not.toHaveAttribute("title")
  })

  it("renders a link containing a title", () => {
    const body =
      "My favorite search engine is " +
      '[Duck Duck Go](https://duckduckgo.com/ "The best search engine for privacy").'
    render(getMarkdownElement(body))
    const link = screen.getByText("Duck Duck Go")
    expect(link).toHaveAttribute("href", "https://duckduckgo.com/")
    expect(link).toHaveAttribute("title", "The best search engine for privacy")
  })

  it("renders a link containing parentheses", () => {
    const body =
      "Here's a link containing parentheses [Yikes](http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx)"
    render(getMarkdownElement(body))
    const link = screen.getByText("Yikes")
    expect(link instanceof HTMLAnchorElement).toBe(true)
    expect(link).toHaveAttribute(
      "href",
      "http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx"
    )
  })

  it("does not render a link if only [text] and no (href)", () => {
    const body = "Don't convert to a link if only [text] and missing (href)"
    render(getMarkdownElement(body))
    const element = screen.getByText("text", { exact: false })
    expect(element).toHaveTextContent(
      "Don't convert to a link if only [text] and missing (href)"
    )
    expect(element instanceof HTMLAnchorElement).toBe(false)
  })
})

describe("StreamlitMarkdown", () => {
  it("renders header anchors when isInSidebar is false", () => {
    const source = "# header"
    render(
      <IsSidebarContext.Provider value={false}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsSidebarContext.Provider>
    )
    expect(screen.getByTestId("StyledLinkIconContainer")).toBeInTheDocument()
  })

  it("renders header anchors when isInDialog is false", () => {
    const source = "# header"
    render(
      <IsDialogContext.Provider value={false}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsDialogContext.Provider>
    )
    expect(screen.getByTestId("StyledLinkIconContainer")).toBeInTheDocument()
  })

  it("passes props properly", () => {
    const source =
      "<a class='nav_item' href='//0.0.0.0:8501/?p=some_page' target='_self'>Some Page</a>"
    render(<StreamlitMarkdown source={source} allowHTML={true} />)
    expect(screen.getByText("Some Page")).toHaveAttribute(
      "href",
      "//0.0.0.0:8501/?p=some_page"
    )
    expect(screen.getByText("Some Page")).toHaveAttribute("target", "_self")
  })

  it("doesn't render header anchors when isInSidebar is true", () => {
    const source = "# header"
    render(
      <IsSidebarContext.Provider value={true}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsSidebarContext.Provider>
    )
    expect(
      screen.queryByTestId("StyledLinkIconContainer")
    ).not.toBeInTheDocument()
  })

  it("doesn't render header anchors when isInDialog is true", () => {
    const source = "# header"
    render(
      <IsDialogContext.Provider value={true}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsDialogContext.Provider>
    )
    expect(
      screen.queryByTestId("StyledLinkIconContainer")
    ).not.toBeInTheDocument()
  })

  it("propagates header attributes to custom header", () => {
    const source = '<h1 data-test="lol">alsdkjhflaf</h1>'
    render(<StreamlitMarkdown source={source} allowHTML />)
    const h1 = screen.getByRole("heading")
    expect(h1).toHaveAttribute("data-test", "lol")
  })

  it("displays captions correctly", () => {
    const source = "hello this is a caption"
    render(<StreamlitMarkdown allowHTML={false} source={source} isCaption />)
    const caption = screen.getByTestId("stCaptionContainer")
    expect(caption).toHaveTextContent("hello this is a caption")
  })

  // Valid Markdown - italics, bold, strikethrough, code, links, emojis, shortcodes
  const validCases = [
    { input: "*Italicized Text*", tag: "em", expected: "Italicized Text" },
    { input: "**Bold Text**", tag: "strong", expected: "Bold Text" },
    {
      input: "~Strikethough Text~",
      tag: "del",
      expected: "Strikethough Text",
    },
    { input: "`Code Block`", tag: "code", expected: "Code Block" },
    { input: "[Link Text](www.example.com)", tag: "a", expected: "Link Text" },
    { input: "🐶", tag: "p", expected: "🐶" },
    { input: ":joy:", tag: "p", expected: "😂" },
  ]

  test.each(validCases)(
    "renders valid markdown when isLabel is true - $tag",
    ({ input, tag, expected }) => {
      render(<StreamlitMarkdown source={input} allowHTML={false} isLabel />)
      const markdownText = screen.getByText(expected)
      expect(markdownText).toBeInTheDocument()

      const expectedTag = markdownText.nodeName.toLowerCase()
      expect(expectedTag).toEqual(tag)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    }
  )

  // Invalid Markdown - images, table elements, headings, unordered/ordered lists, task lists, horizontal rules, & blockquotes
  const table = `| Syntax | Description |
  | ----------- | ----------- |
  | Header      | Title       |
  | Paragraph   | Text        |`
  const tableText = "Syntax Description Header Title Paragraph Text"
  const horizontalRule = `

  ---

  Horizontal rule
  `

  const invalidCases = [
    { input: table, tag: "table", expected: tableText },
    { input: table, tag: "thead", expected: tableText },
    { input: table, tag: "tbody", expected: tableText },
    { input: table, tag: "tr", expected: tableText },
    { input: table, tag: "th", expected: tableText },
    { input: table, tag: "td", expected: tableText },
    { input: "# Heading 1", tag: "h1", expected: "Heading 1" },
    { input: "## Heading 2", tag: "h2", expected: "Heading 2" },
    { input: "### Heading 3", tag: "h3", expected: "Heading 3" },
    { input: "- List Item 1", tag: "ul", expected: "List Item 1" },
    { input: "- List Item 1", tag: "li", expected: "List Item 1" },
    { input: "1. List Item 1", tag: "ol", expected: "List Item 1" },
    { input: "1. List Item 1", tag: "li", expected: "List Item 1" },
    {
      input: "- [ ] Task List Item 1",
      tag: "input",
      expected: "Task List Item 1",
    },
    { input: horizontalRule, tag: "hr", expected: "Horizontal rule" },
    { input: "> Blockquote", tag: "blockquote", expected: "Blockquote" },
  ]

  test.each(invalidCases)(
    "does NOT render invalid markdown when isLabel is true - $tag",
    ({ input, tag, expected }) => {
      render(<StreamlitMarkdown source={input} allowHTML={false} isLabel />)
      const markdownText = screen.getByText(expected)
      expect(markdownText).toBeInTheDocument()

      const expectedTag = markdownText.nodeName.toLowerCase()
      expect(expectedTag).not.toEqual(tag)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    }
  )

  it("doesn't render images when isLabel is true", () => {
    const source =
      "![Image Text](https://dictionary.cambridge.org/us/images/thumb/corgi_noun_002_08554.jpg?version=5.0.297)"

    render(<StreamlitMarkdown source={source} allowHTML={false} isLabel />)
    const image = screen.queryByAltText("Image Text")
    expect(image).not.toBeInTheDocument()
  })

  it("doesn't render links when disableLinks is true", () => {
    // Valid markdown further restricted with buttons to eliminate links
    const source = "[Link text](www.example.com)"
    render(
      <StreamlitMarkdown
        source={source}
        allowHTML={false}
        isLabel
        disableLinks
      />
    )
    const tag = screen.getByText("Link text")
    expect(tag instanceof HTMLAnchorElement).toBe(false)
  })

  it("renders smaller text sizing when isToast is true", () => {
    const source = "Here is some toast text"
    render(<StreamlitMarkdown source={source} allowHTML={false} isToast />)

    const textTag = screen.getByText("Here is some toast text")
    expect(textTag).toHaveStyle("font-size: 14px")
  })

  it("renders regular text sizing when largerLabel is true", () => {
    const source = "Here is some checkbox label text"
    render(
      <StreamlitMarkdown
        source={source}
        allowHTML={false}
        isLabel
        largerLabel
      />
    )

    const textTag = screen.getByText("Here is some checkbox label text")
    expect(textTag).toHaveStyle("font-size: inherit")
  })

  it("renders bold label text when boldLabel is true", () => {
    const source = "Here is some checkbox label text"
    render(
      <StreamlitMarkdown
        source={source}
        allowHTML={false}
        isLabel
        boldLabel
        largerLabel
      />
    )

    const textTag = screen.getByText("Here is some checkbox label text")
    expect(textTag).toHaveStyle("font-weight: 600")
  })

  it("colours text properly", () => {
    const colorMapping = new Map([
      ["red", colors.red80],
      ["blue", colors.blue80],
      ["green", colors.green90],
      ["violet", colors.purple80],
      ["orange", colors.orange100],
      ["gray", colors.gray80],
      ["grey", colors.gray80],
      ["rainbow", "transparent"],
    ])

    colorMapping.forEach(function (style, color) {
      const source = `:${color}[text]`
      render(<StreamlitMarkdown source={source} allowHTML={false} />)
      const markdown = screen.getByText("text")
      const tagName = markdown.nodeName.toLowerCase()
      expect(tagName).toBe("span")
      expect(markdown).toHaveStyle(`color: ${style}`)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    })
  })

  it("properly adds background colors", () => {
    const redbg = transparentize(colors.red80, 0.9)
    const orangebg = transparentize(colors.yellow70, 0.9)
    const yellowbg = transparentize(colors.yellow70, 0.9)
    const greenbg = transparentize(colors.green70, 0.9)
    const bluebg = transparentize(colors.blue70, 0.9)
    const violetbg = transparentize(colors.purple70, 0.9)
    const purplebg = transparentize(colors.purple90, 0.9)
    const graybg = transparentize(colors.gray70, 0.9)

    const colorMapping = new Map([
      ["red", redbg],
      ["blue", bluebg],
      ["green", greenbg],
      ["violet", violetbg],
      ["orange", orangebg],
      ["gray", graybg],
      ["grey", graybg],
      [
        "rainbow",
        `linear-gradient(to right, ${redbg}, ${orangebg}, ${yellowbg}, ${greenbg}, ${bluebg}, ${violetbg}, ${purplebg})`,
      ],
    ])

    colorMapping.forEach(function (style, color) {
      const source = `:${color}-background[text]`
      render(<StreamlitMarkdown source={source} allowHTML={false} />)
      const markdown = screen.getByText("text")
      const tagName = markdown.nodeName.toLowerCase()
      expect(tagName).toBe("span")
      expect(markdown).toHaveStyle(`background-color: ${style}`)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    })
  })
})

const getCustomCodeTagProps = (
  props: Partial<CustomCodeTagProps> = {}
): CustomCodeTagProps => ({
  children: [
    `import streamlit as st

st.write("Hello")
`,
  ],
  node: { type: "element", tagName: "tagName", children: [] },
  ...props,
})

describe("CustomCodeTag Element", () => {
  it("should render without crashing", () => {
    const props = getCustomCodeTagProps()
    render(<CustomCodeTag {...props} />)

    const codeTag = screen.getByText(`st.write("Hello")`)
    const tagName = codeTag.nodeName.toLowerCase()

    expect(codeTag).toBeInTheDocument()
    expect(tagName).toBe("code")
  })

  it("should render as plaintext", () => {
    const props = getCustomCodeTagProps({ className: "language-plaintext" })
    render(<CustomCodeTag {...props} />)

    const codeTag = screen.getByText(`st.write("Hello")`)
    expect(codeTag).toHaveClass("language-plaintext")
  })

  it("should render copy button when code block has content", () => {
    const props = getCustomCodeTagProps({
      children: ["i am not empty"],
    })
    render(<CustomCodeTag {...props} />)
    const copyButton = screen.getByTitle("Copy to clipboard")

    expect(copyButton).not.toBeNull()
  })

  it("should not render copy button when code block is empty", () => {
    const props = getCustomCodeTagProps({
      children: [""],
    })
    render(<CustomCodeTag {...props} />)
    // queryBy returns null vs. error
    const copyButton = screen.queryByRole("button") // eslint-disable-line testing-library/prefer-presence-queries

    expect(copyButton).toBeNull()
  })

  it("should render inline", () => {
    const props = getCustomCodeTagProps({ inline: true })
    const { baseElement } = render(<CustomCodeTag {...props} />)
    expect(baseElement.innerHTML).toBe(
      "<div><code>" +
        "import streamlit as st\n\n" +
        'st.write("Hello")\n' +
        "</code></div>"
    )
  })
})
