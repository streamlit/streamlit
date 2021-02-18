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
import { mount, shallow } from "lib/test_util"
import { logWarning } from "lib/log"
import CodeBlock, { CodeBlockProps } from "./CodeBlock"

jest.mock("lib/log", () => ({
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

  it("should warn if there's no highlight available", () => {
    // @ts-ignore
    global.console = { warn: jest.fn() }

    const props = getProps({
      language: "CoffeeScript",
    })
    mount(<CodeBlock {...props} />)
    expect(logWarning).toHaveBeenCalledWith(
      "No syntax highlighting for CoffeeScript."
    )
  })
})
