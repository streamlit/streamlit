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

import React from "react"
import { mount, shallow } from "src/lib/test_util"
import { logWarning } from "src/lib/log"
import CodeBlock, { CodeBlockProps } from "./CodeBlock"
import CopyButton from "./CopyButton"

jest.mock("src/lib/log", () => ({
  logWarning: jest.fn(),
  logMessage: jest.fn(),
}))

const getProps = (props: Partial<CodeBlockProps> = {}): CodeBlockProps => ({
  value: `
    import streamlit as st

    st.write("Hello")
  `,
  ...props,
})

describe("CodeBlock Element", () => {
  it("should render without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<CodeBlock {...props} />)

    expect(wrapper.find("StyledCodeBlock").length).toBe(1)
  })

  it("should render with language", () => {
    const props = getProps({
      language: "python",
    })
    const wrapper = mount(<CodeBlock {...props} />)

    expect(wrapper.find("StyledCodeBlock").length).toBe(1)
    expect(wrapper.find("code").prop("className")).toBe("language-python")
  })

  it("should default to python if no language specified", () => {
    const props = getProps()
    const wrapper = mount(<CodeBlock {...props} />)
    expect(logWarning).toHaveBeenCalledWith(
      "No language provided, defaulting to Python"
    )
    expect(wrapper.find("code").prop("className")).toBe("language-python")
  })

  it("should render copy button when code block has content", () => {
    const props = getProps({
      value: "i am not empty",
      language: null,
    })
    const wrapper = mount(<CodeBlock {...props} />)
    expect(wrapper.find(CopyButton)).toHaveLength(1)
  })

  it("should not render copy button when code block is empty", () => {
    const props = getProps({
      value: "",
    })
    const wrapper = mount(<CodeBlock {...props} />)
    expect(wrapper.find(CopyButton)).toHaveLength(0)
  })

  it("should warn if there's no highlight available", () => {
    // @ts-ignore
    global.console = { warn: jest.fn() }

    const props = getProps({
      language: "CoffeeScript",
    })
    const wrapper = mount(<CodeBlock {...props} />)
    expect(logWarning).toHaveBeenCalledWith(
      "No syntax highlighting for CoffeeScript."
    )
    expect(wrapper.find("code").prop("className")).toBeUndefined()
  })
})
