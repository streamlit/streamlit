/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import {
  linkWithTargetBlank,
  linkReferenceHasParens,
} from "./StreamlitMarkdown"
import { create } from "react-test-renderer"

// Fixture Generator
const getMarkdownElement = (body): ReactElement => {
  const renderers = {
    link: linkWithTargetBlank,
    linkReference: linkReferenceHasParens,
  }
  return <ReactMarkdown source={body} renderers={renderers} />
}

describe("linkReference", () => {
  it("renders a link with _blank target", () => {
    const body =
      'Some random URL like [Streamlit](https://streamlit.io" target="_blank")'
    const component = create(getMarkdownElement(body))
    const instance = component.root
    expect(instance.findByType(linkWithTargetBlank).props.href).toBe(
      "https://streamlit.io"
    )
  })
  it("renders a link without title", () => {
    const body =
      "Everybody loves [The Internet Archive](https://archive.org/)."
    const component = create(getMarkdownElement(body))
    const instance = component.root
    expect(instance.findByType(linkWithTargetBlank).props.href).toBe(
      "https://archive.org/"
    )
  })
  it("renders a link containing a title", () => {
    const body =
      "My favorite search engine is " +
      "[Duck Duck Go](https://duckduckgo.com " +
      '"The best search engine for privacy").'
    const component = create(getMarkdownElement(body))
    const instance = component.root
    expect(instance.findByType(linkWithTargetBlank).props.href).toBe(
      "https://duckduckgo.com"
    )
  })
  it("renders a link containing parentheses", () => {
    const body =
      "Here's a link containing parentheses [Yikes](http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx)"
    const component = create(getMarkdownElement(body))
    const instance = component.root
    const hrefobj = instance.findByType(linkWithTargetBlank)
    expect(hrefobj.props.href).toBe(
      "http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx"
    )
  })
  it("does not render a link if only [text] and no (href)", () => {
    const body = "Don't convert to a link if only [text] and missing (href)"
    const component = create(getMarkdownElement(body))
    const instance = component.root
    // should be no link object
    expect(() => {
      instance.findByType(linkWithTargetBlank).props.href
    }).toThrow()
  })
})
