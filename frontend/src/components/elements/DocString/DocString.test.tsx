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
import { shallow } from "enzyme"

import { DocString as DocStringProto } from "src/autogen/proto"
import DocString, { DocStringProps } from "./DocString"

const getProps = (
  elementProps: Partial<DocStringProto> = {}
): DocStringProps => ({
  element: DocStringProto.create({
    name: "st.balloons",
    value: "streamlit.balloons()",
    docString:
      "Draw celebratory balloons.\n\nExample\n-------\n>>> st.balloons()\n\n...then watch your app and get ready for a celebration!",
    type: "method",
    ...elementProps,
  }),
  width: 0,
})

describe("DocString Element", () => {
  const props = getProps()
  const wrapper = shallow(<DocString {...props} />)

  it("renders without crashing", () => {
    expect(wrapper).toBeDefined()
  })

  it("should render a doc-string", () => {
    expect(wrapper.find("StyledDocString").text()).toBe(
      props.element.docString
    )
  })

  it("should render 'no docs' text when empty", () => {
    const props = getProps({
      docString: undefined,
    })
    const wrapper = shallow(<DocString {...props} />)

    expect(wrapper.find("StyledDocString").text()).toBe("No docs available")
  })

  describe("doc-header", () => {
    it("should render a name", () => {
      expect(wrapper.find("StyledDocName").text()).toBe("st.balloons")
    })

    it("should render value", () => {
      expect(wrapper.find("StyledDocValue").text()).toBe(
        "streamlit.balloons()"
      )
    })

    it("should render a type", () => {
      expect(wrapper.find("StyledDocType").text()).toBe("method")
    })

    describe("should render empty when", () => {
      const props = getProps({
        name: undefined,
        value: undefined,
        type: undefined,
      })
      const wrapper = shallow(<DocString {...props} />)

      it("there's no name", () => {
        expect(wrapper.find("StyledDocName").length).toBeFalsy()
      })

      it("there's no value", () => {
        expect(wrapper.find("StyledDocValue").length).toBeFalsy()
      })

      it("there's no type", () => {
        expect(wrapper.find("StyledDocType").length).toBeFalsy()
      })
    })

    // Testing cases that we expect to happen (won't test every combination)
    it("should render a type and value when there's no name", () => {
      const props = getProps({
        name: undefined,
      })
      const wrapper = shallow(<DocString {...props} />)

      expect(wrapper.find("StyledDocName").length).toBeFalsy()
      expect(wrapper.find("StyledDocValue").text()).toBe(
        "streamlit.balloons()"
      )
      expect(wrapper.find("StyledDocType").text()).toBe("method")
    })

    // Testing cases that we expect to happen (won't test every combination)
    it("should render a name and type when there's no value", () => {
      const props = getProps({
        value: undefined,
      })
      const wrapper = shallow(<DocString {...props} />)

      expect(wrapper.find("StyledDocName").text()).toBe("st.balloons")
      expect(wrapper.find("StyledDocValue").length).toBeFalsy()
      expect(wrapper.find("StyledDocType").text()).toBe("method")
    })
  })
})
