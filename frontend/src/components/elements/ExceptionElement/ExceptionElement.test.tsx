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
import { fromJS } from "immutable"

import { StreamlitMarkdown } from "components/shared/StreamlitMarkdown"
import ExceptionElement, { Props } from "./ExceptionElement"

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    stackTrace: ["step 1", "step 2", "step 3"],
    type: "RuntimeError",
    message: "This is an exception of type RuntimeError",
    messageIsMarkdown: false,
    ...elementProps,
  }),
  width: 0,
})

describe("ExceptionElement Element", () => {
  const props = getProps()
  const wrapper = shallow(<ExceptionElement {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.html()).toMatchSnapshot()
  })

  it("should render the complete stack", () => {
    expect(wrapper.find(".stack-trace-title").text()).toBe("Traceback:")

    const traceRows = wrapper.find("code .stack-trace-row")
    expect(traceRows.length).toBe(3)

    traceRows.forEach((val, id) => {
      expect(val.prop("children")).toBe(`step ${id + 1}`)
    })
  })

  it("should render markdown when it has messageIsMarkdown", () => {
    const props = getProps({
      messageIsMarkdown: true,
    })
    const wrapper = shallow(<ExceptionElement {...props} />)

    expect(wrapper.find(StreamlitMarkdown).length).toBe(1)
    expect(wrapper.find(StreamlitMarkdown).props()).toMatchSnapshot()
  })

  it("should render if there's no message", () => {
    const props = getProps({
      message: null,
    })
    const wrapper = shallow(<ExceptionElement {...props} />)

    expect(wrapper.find("div .message").text()).toBe("RuntimeError")
  })
})
