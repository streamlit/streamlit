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
import { render, mount } from "src/lib/test_util"
import { cleanup } from "@testing-library/react"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"
import { Heading as HeadingProto } from "src/autogen/proto"
import { colors } from "src/theme/primitives/colors"
import StreamlitMarkdown, {
  LinkWithTargetBlank,
  createAnchorFromText,
  HeadingWithAnchor,
  Heading,
  HeadingProtoProps,
} from "./StreamlitMarkdown"

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

  it("renders valid markdown when isLabel is true", () => {
    // Valid Markdown - italics, bold, strikethrough, code, links, emojis, shortcodes
    const cases = [
      ["*Italicized Text*", "em", "Italicized Text"],
      ["**Bold Text**", "strong", "Bold Text"],
      ["~Strikethough Text~", "del", "Strikethough Text"],
      ["`Code Block`", "code", "Code Block"],
      ["[Link Text](www.example.com)", "a", "Link Text"],
      ["🐶", "p", "🐶"],
      [":joy:", "p", "😂"],
    ]

    cases.forEach(([source, tagType, text]) => {
      const wrapper = render(
        <StreamlitMarkdown source={source} allowHTML={false} isLabel />
      )
      const container = wrapper.getByTestId("stMarkdownContainer")
      const expectedTag = container.querySelector(tagType)
      expect(expectedTag).not.toBeNull()
      expect(expectedTag).toHaveTextContent(text)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    })
  })

  it("doesn't render invalid markdown when isLabel is true", () => {
    // Invalid Markdown - images, table elements, headings, unordered/ordered lists, task lists, horizontal rules, & blockquotes
    const table = `| Syntax | Description |
    | ----------- | ----------- |
    | Header      | Title       |
    | Paragraph   | Text        |`

    const tableText =
      "| Syntax | Description | | ----------- | ----------- | | Header | Title | | Paragraph | Text |"

    const horizontalRule = `

    ---

    Horizontal rule
    `

    const cases = [
      [
        "![Image Text](https://dictionary.cambridge.org/us/images/thumb/corgi_noun_002_08554.jpg?version=5.0.297)",
        "img",
        "",
      ],
      [table, "table", tableText],
      [table, "thead", tableText],
      [table, "tbody", tableText],
      [table, "tr", tableText],
      [table, "th", tableText],
      [table, "td", tableText],
      ["# Heading 1", "h1", "Heading 1"],
      ["## Heading 2", "h2", "Heading 2"],
      ["### Heading 3", "h3", "Heading 3"],
      ["- List Item 1", "ul", "List Item 1"],
      ["- List Item 1", "li", "List Item 1"],
      ["1. List Item 1", "ol", "List Item 1"],
      ["1. List Item 1", "li", "List Item 1"],
      ["- [ ] Task List Item 1", "input", "Task List Item 1"],
      [horizontalRule, "hr", "Horizontal rule"],
      ["> Blockquote", "blockquote", "Blockquote"],
    ]

    cases.forEach(([source, disallowedTag, text]) => {
      const wrapper = render(
        <StreamlitMarkdown source={source} allowHTML={false} isLabel />
      )
      const container = wrapper.getByTestId("stMarkdownContainer")
      const invalidTag = container.querySelector(disallowedTag)
      expect(invalidTag).toBeNull()
      expect(container).toHaveTextContent(text)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    })
  })

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
