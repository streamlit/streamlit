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

import { DocString as DocStringProto } from "src/lib/proto"
import DocString, { DocStringProps, Member } from "./DocString"

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

  describe("members table", () => {
    it("should render no members when there are none", () => {
      expect(wrapper.find("StyledMembersRow").length).toBe(0)
    })

    it("should render members", () => {
      const props = getProps({
        members: [
          {
            name: "member1",
            value: "value1",
            type: "type1",
          },
          {
            name: "member2",
            value: "value2",
            type: "type2",
          },
        ],
      })
      const wrapper = shallow(<DocString {...props} />)

      expect(wrapper.find("Member").length).toBe(2)
    })
  })
})

describe("Member Element", () => {
  it("should render value-oriented members", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
        value: "value1",
      },
    }

    const wrapper = shallow(<Member {...props} />)

    expect(wrapper.find("StyledDocName").text()).toBe("member1")
    expect(wrapper.find("StyledDocType").text()).toBe("type1")
    expect(wrapper.find("StyledDocValue").text()).toBe("value1")
  })

  it("should render doc-oriented members", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
        docString: "docstring1",
      },
    }

    const wrapper = shallow(<Member {...props} />)

    expect(wrapper.find("StyledDocName").text()).toBe("member1")
    expect(wrapper.find("StyledDocType").text()).toBe("type1")
    expect(wrapper.find("StyledDocValue").text()).toBe("docstring1")
  })

  it("should prefer value over doc", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
        value: "value1",
        docString: "docstring1",
      },
    }

    const wrapper = shallow(<Member {...props} />)

    expect(wrapper.find("StyledDocName").text()).toBe("member1")
    expect(wrapper.find("StyledDocType").text()).toBe("type1")
    expect(wrapper.find("StyledDocValue").text()).toBe("value1")
  })

  it("should tell you when there are no docs", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
      },
    }

    const wrapper = shallow(<Member {...props} />)

    expect(wrapper.find("StyledDocName").text()).toBe("member1")
    expect(wrapper.find("StyledDocType").text()).toBe("type1")
    expect(wrapper.find("StyledDocValue").text()).toBe("No docs available")
  })

  it("should only show type if present", () => {
    const props = {
      member: {
        name: "member1",
      },
    }

    const wrapper = shallow(<Member {...props} />)

    expect(wrapper.find("StyledDocName").text()).toBe("member1")
    expect(wrapper.find("StyledDocType").length).toBe(0)
  })
})
