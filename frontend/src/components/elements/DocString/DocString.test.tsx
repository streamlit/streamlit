import React from "react"
import { shallow } from "enzyme"

import { DocString as DocStringProto } from "src/autogen/proto"
import DocString, { DocStringProps } from "./DocString"

const getProps = (
  elementProps: Partial<DocStringProto> = {}
): DocStringProps => ({
  element: DocStringProto.create({
    name: "balloons",
    module: "streamlit",
    docString:
      "Draw celebratory balloons.\n\nExample\n-------\n>>> st.balloons()\n\n...then watch your app and get ready for a celebration!",
    type: "<class 'method'>",
    signature: "(element)",
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

  describe("doc-header", () => {
    it("should render module", () => {
      expect(wrapper.find("StyledDocModule").text()).toBe("streamlit.")
    })

    it("should render a name", () => {
      expect(wrapper.find("StyledDocName").text()).toBe("balloons")
    })

    it("should render a signature", () => {
      expect(wrapper.find(".doc-signature").text()).toBe("(element)")
    })

    describe("should render empty when", () => {
      const props = getProps({
        module: undefined,
        signature: undefined,
      })
      const wrapper = shallow(<DocString {...props} />)

      it("there's no module", () => {
        expect(wrapper.find(".doc-header .doc-module").length).toBeFalsy()
      })

      it("there's no signature", () => {
        expect(wrapper.find(".doc-header .doc-signature").length).toBeFalsy()
      })
    })

    it("should render a type when there's no name", () => {
      const props = getProps({
        name: undefined,
        module: undefined,
        signature: undefined,
      })
      const wrapper = shallow(<DocString {...props} />)

      expect(wrapper.find("StyledDocHeader").text()).toBe("<class 'method'>")
    })
  })
})
