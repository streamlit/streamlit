/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import ReactMarkdown from "react-markdown"
import { mount } from "src/lib/test_util"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"

import StreamlitMarkdown, {
  linkWithTargetBlank,
  linkReferenceHasParens,
  createAnchorFromText,
  HeadingWithAnchor,
} from "./StreamlitMarkdown"

import {
  StyledStreamlitMarkdown,
  StyledLinkIconContainer,
} from "./styled-components"

// Fixture Generator
const getMarkdownElement = (body: string): ReactElement => {
  const renderers = {
    link: linkWithTargetBlank,
    linkReference: linkReferenceHasParens,
  }
  return <ReactMarkdown source={body} renderers={renderers} />
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
      wrapper
        .find(HeadingWithAnchor)
        .find("h1")
        .prop("data-test")
    ).toEqual("lol")
  })

  it("displays captions correctly", () => {
    const source = "hello this is a caption"
    const wrapper = mount(
      <StreamlitMarkdown allowHTML={false} source={source} isCaption />
    )
    expect(
      wrapper
        .find(StyledStreamlitMarkdown)
        .find("small")
        .text()
    ).toEqual("hello this is a caption")
  })
})
