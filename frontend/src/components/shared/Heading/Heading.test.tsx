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

import React from "react"
import { mount } from "src/lib/test_util"
import { Heading as HeadingProto } from "src/autogen/proto"
import { Heading, createAnchorFromText, HeadingProtoProps } from "./Heading"

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
