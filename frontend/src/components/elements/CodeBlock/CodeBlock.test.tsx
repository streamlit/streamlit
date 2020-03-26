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

import React from "react"
import { shallow } from "enzyme"

import CodeBlock, { Props } from "./CodeBlock"

const getProps = (props: object = {}): Props => ({
  width: 0,
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

    expect(wrapper.find("div.stCodeBlock").length).toBe(1)
  })

  it("should render with language", () => {
    const props = getProps({
      language: "python",
    })
    const wrapper = shallow(<CodeBlock {...props} />)

    expect(wrapper.find("div.stCodeBlock").length).toBe(1)
    expect(wrapper.find("code").prop("className")).toBe("language-python")
  })

  it("should warn if there's no highlight available", () => {
    // @ts-ignore
    global.console = { warn: jest.fn() }

    const props = getProps({
      language: "CoffeeScript",
    })
    const wrapper = shallow(<CodeBlock {...props} />)

    expect(console.warn).toHaveBeenCalledWith(
      "No syntax highlighting for CoffeeScript; defaulting to Python"
    )
    expect(wrapper.find("code").prop("className")).toBe("language-python")
  })
})
