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

import React, { ReactElement } from "react"
import "@testing-library/jest-dom"
import ReactMarkdown from "react-markdown"
import { mount, render } from "src/lib/test_util"
import { cleanup } from "@testing-library/react"
import IsSidebarContext from "src/lib/components/core/IsSidebarContext"
import { Heading as HeadingProto } from "src/lib/proto"
import { colors } from "src/lib/theme/primitives/colors"
import StreamlitMarkdown, {
  LinkWithTargetBlank,
  createAnchorFromText,
  HeadingWithAnchor,
  Heading,
  HeadingProtoProps,
  CustomCodeTag,
  CustomCodeTagProps,
} from "./StreamlitMarkdown"

import {
  InlineTooltipIcon,
  StyledLabelHelpWrapper,
} from "src/lib/components/shared/TooltipIcon"

import { StyledLinkIconContainer } from "./styled-components"

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
    const wrapper = mount(getMarkdownElement(body))
    expect(wrapper.find("a").prop("href")).toEqual("https://streamlit.io/")
    expect(wrapper.find("a").prop("target")).toEqual("_blank")
  })

  it("renders a link without title", () => {
    const body =
      "Everybody loves [The Internet Archive](https://archive.org/)."
    const wrapper = mount(getMarkdownElement(body))

    expect(wrapper.find("a").prop("href")).toEqual("https://archive.org/")
    expect(wrapper.find("a").prop("title")).toBeUndefined()
  })

  it("renders a link containing a title", () => {
    const body =
      "My favorite search engine is " +
      '[Duck Duck Go](https://duckduckgo.com/ "The best search engine for privacy").'
    const wrapper = mount(getMarkdownElement(body))

    expect(wrapper.find("a").prop("href")).toEqual("https://duckduckgo.com/")
    expect(wrapper.find("a").prop("title")).toBe(
      "The best search engine for privacy"
    )
  })

  it("renders a link containing parentheses", () => {
    const body =
      "Here's a link containing parentheses [Yikes](http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx)"
    const wrapper = mount(getMarkdownElement(body))

    expect(wrapper.find("a").prop("href")).toEqual(
      "http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx"
    )
  })

  it("does not render a link if only [text] and no (href)", () => {
    const body = "Don't convert to a link if only [text] and missing (href)"
    const wrapper = mount(getMarkdownElement(body))

    expect(wrapper.text()).toEqual(
      "Don't convert to a link if only [text] and missing (href)"
    )
    expect(wrapper.find("a").exists()).toBe(false)
  })
})

describe("StreamlitMarkdown", () => {
  it("renders header anchors when isSidebar is false", () => {
    const source = "# header"
    const wrapper = mount(
      <IsSidebarContext.Provider value={false}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsSidebarContext.Provider>
    )
    expect(wrapper.find(StyledLinkIconContainer).exists()).toBeTruthy()
  })

  it("passes props properly", () => {
    const source =
      "<a class='nav_item' href='//0.0.0.0:8501/?p=some_page' target='_self'>Some Page</a>"
    const wrapper = mount(
      <StreamlitMarkdown source={source} allowHTML={true} />
    )

    expect(wrapper.find("a").prop("href")).toEqual(
      "//0.0.0.0:8501/?p=some_page"
    )
    expect(wrapper.find("a").prop("target")).toEqual("_self")
  })

  it("doesn't render header anchors when isSidebar is true", () => {
    const source = "# header"
    const wrapper = mount(
      <IsSidebarContext.Provider value={true}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsSidebarContext.Provider>
    )
    expect(wrapper.find(StyledLinkIconContainer).exists()).toBeFalsy()
  })

  it("propagates header attributes to custom header", () => {
    const source = '<h1 data-test="lol">alsdkjhflaf</h1>'
    const wrapper = mount(<StreamlitMarkdown source={source} allowHTML />)
    expect(
      wrapper.find(HeadingWithAnchor).find("h1").prop("data-test")
    ).toEqual("lol")
  })

  it("displays captions correctly", () => {
    const source = "hello this is a caption"
    const wrapper = mount(
      <StreamlitMarkdown allowHTML={false} source={source} isCaption />
    )
    expect(wrapper.find("StyledStreamlitMarkdown").text()).toEqual(
      "hello this is a caption"
    )
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
      const wrapper = render(
        <StreamlitMarkdown source={input} allowHTML={false} isLabel />
      )
      const container = wrapper.getByTestId("stMarkdownContainer")
      const expectedTag = container.querySelector(tag)
      expect(expectedTag).not.toBeNull()
      expect(expectedTag).toHaveTextContent(expected)

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
    {
      input:
        "![Image Text](https://dictionary.cambridge.org/us/images/thumb/corgi_noun_002_08554.jpg?version=5.0.297)",
      tag: "img",
      expected: "",
    },
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
      const wrapper = render(
        <StreamlitMarkdown source={input} allowHTML={false} isLabel />
      )
      const container = wrapper.getByTestId("stMarkdownContainer")
      const invalidTag = container.querySelector(tag)
      expect(invalidTag).toBeNull()
      expect(container).toHaveTextContent(expected)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    }
  )

  it("doesn't render links when isButton is true", () => {
    // Valid markdown further restricted with buttons to eliminate links
    const source = "Link: [text](www.example.com)"
    const wrapper = render(
      <StreamlitMarkdown source={source} allowHTML={false} isLabel isButton />
    )
    const container = wrapper.getByTestId("stMarkdownContainer")
    const invalidTag = container.querySelector("a")
    expect(invalidTag).toBeNull()
    expect(container).toHaveTextContent("Link: ")
  })

  it("colours text properly", () => {
    const colorMapping = new Map([
      ["red", colors.red80],
      ["blue", colors.blue80],
      ["green", colors.green90],
      ["violet", colors.purple80],
      ["orange", colors.orange100],
    ])

    colorMapping.forEach(function (style, color) {
      const source = `:${color}[text]`
      const wrapper = render(
        <StreamlitMarkdown source={source} allowHTML={false} />
      )

      const container = wrapper.getByTestId("stMarkdownContainer")
      const span = container.querySelector("span")

      expect(span).toHaveStyle(`color: ${style}`)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    })
  })
})

const getHeadingProps = (
  elementProps: Partial<HeadingProto> = {}
): HeadingProtoProps => ({
  width: 5,
  element: HeadingProto.create({
    anchor: "some-anchor",
    tag: "h1",
    body: `hello world
          this is a new line`,
    ...elementProps,
  }),
})

describe("Heading", () => {
  it("renders properly after a new line", () => {
    const props = getHeadingProps()
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("h1").text()).toEqual("hello world")
    expect(wrapper.find("RenderedMarkdown").at(1).text()).toEqual(
      "this is a new line"
    )
  })

  it("renders properly without a new line", () => {
    const props = getHeadingProps({ body: "hello" })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("h1").text()).toEqual("hello")
    expect(wrapper.find("StyledStreamlitMarkdown")).toHaveLength(1)
  })

  it("renders anchor link", () => {
    const props = getHeadingProps({ body: "hello" })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("StyledLinkIcon")).toHaveLength(1)
  })

  it("does not renders anchor link when it is hidden", () => {
    const props = getHeadingProps({ body: "hello", hideAnchor: true })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("StyledLinkIcon")).toHaveLength(0)
  })

  it("renders properly with help text", () => {
    const props = getHeadingProps({ body: "hello", help: "help text" })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("h1").text()).toEqual("hello")
    expect(wrapper.find("StyledStreamlitMarkdown")).toHaveLength(1)
    expect(wrapper.find(StyledLabelHelpWrapper).exists()).toBe(true)
    const inlineTooltipIcon = wrapper.find(InlineTooltipIcon)
    expect(inlineTooltipIcon.exists()).toBe(true)
    expect(inlineTooltipIcon.props().content).toBe("help text")
  })

  it("does not render ol block", () => {
    const props = getHeadingProps({ body: "1) hello" })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("h1").text()).toEqual("1) hello")
    expect(wrapper.find("ol")).toHaveLength(0)
  })

  it("does not render ul block", () => {
    const props = getHeadingProps({ body: "* hello" })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("h1").text()).toEqual("* hello")
    expect(wrapper.find("ul")).toHaveLength(0)
  })

  it("does not render blockquote with >", () => {
    const props = getHeadingProps({ body: ">hello" })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("h1").text()).toEqual(">hello")
    expect(wrapper.find("blockquote")).toHaveLength(0)
  })

  it("does not render tables", () => {
    const props = getHeadingProps({
      body: `| Syntax | Description |
        | ----------- | ----------- |
        | Header      | Title       |
        | Paragraph   | Text        |`,
    })
    const wrapper = mount(<Heading {...props} />)
    expect(wrapper.find("h1").text()).toEqual(`| Syntax | Description |`)
    expect(wrapper.find("RenderedMarkdown").at(1).text()).toEqual(
      `| ----------- | ----------- |
    | Header      | Title       |
    | Paragraph   | Text        |`
    )
    expect(wrapper.find("table")).toHaveLength(0)
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
    const { baseElement } = render(<CustomCodeTag {...props} />)

    expect(baseElement.querySelectorAll("pre code")).toHaveLength(1)
  })

  it("should render as plaintext", () => {
    const props = getCustomCodeTagProps({ className: "language-plaintext" })
    const { baseElement } = render(<CustomCodeTag {...props} />)

    expect(baseElement.querySelector("pre code")?.outerHTML).toBe(
      '<code class="language-plaintext" style="white-space: pre;"><span>import streamlit as st\n' +
        "</span>\n" +
        'st.write("Hello")</code>'
    )
  })

  it("should render copy button when code block has content", () => {
    const props = getCustomCodeTagProps({
      children: ["i am not empty"],
    })
    const { baseElement } = render(<CustomCodeTag {...props} />)
    expect(
      baseElement.querySelectorAll('[title="Copy to clipboard"]')
    ).toHaveLength(1)
  })

  it("should not render copy button when code block is empty", () => {
    const props = getCustomCodeTagProps({
      children: [""],
    })
    const { baseElement } = render(<CustomCodeTag {...props} />)
    expect(
      baseElement.querySelectorAll('[title="Copy to clipboard"]')
    ).toHaveLength(0)
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
