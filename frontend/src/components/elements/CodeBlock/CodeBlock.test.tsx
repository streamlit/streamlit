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
import { mount, shallow } from "src/lib/test_util"
import { CodeTag, CodeBlock, CodeTagProps, CodeBlockProps } from "./CodeBlock"
import CopyButton from "./CopyButton"

const getTagProps = (props: Partial<CodeTagProps> = {}): CodeTagProps => {
  const defaultChildren = [
    `
    import streamlit as st

    st.write("Hello")
  `,
  ]
  return {
    node: { type: "element", tagName: "code", children: [] },
    key: "example",
    inline: false,
    className: "language-python",
    children: defaultChildren,
    ...props,
  }
}

const getBlockProps = (
  props: Partial<CodeBlockProps> = {}
): CodeBlockProps => ({
  children: [
    `
    import streamlit as st

    st.write("Hello")
  `,
  ],
  ...props,
})

describe("CodeBlock Element", () => {
  it("should render without crashing", () => {
    const props = getBlockProps()
    const wrapper = shallow(<CodeBlock {...props} />)

    expect(wrapper.find("StyledCodeBlock").length).toBe(1)
  })

  it("should render with language", () => {
    const props = getTagProps()
    const wrapper = mount(<CodeBlock {...props} />)

    expect(wrapper.find("StyledCodeBlock").length).toBe(1)
  })

  it("should default to python if no language specified", () => {
    const props = getTagProps()
    const wrapper = mount(<CodeTag {...props} />)
    expect(wrapper.find("SyntaxHighlighter").prop("language")).toBe("python")
  })

  it("should render copy button when code block has content", () => {
    const props = getTagProps({
      children: ["i am not empty"],
    })
    const wrapper = mount(<CodeTag {...props} />)
    expect(wrapper.find(CopyButton)).toHaveLength(1)
  })

  it("should not render copy button when code block is empty", () => {
    const props = getBlockProps({
      children: [""],
    })
    const wrapper = mount(<CodeBlock {...props} />)
    expect(wrapper.find(CopyButton)).toHaveLength(0)
  })
})
