import React from "react"
import { mount } from "src/lib/test_util"

import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { Exception as ExceptionProto } from "src/autogen/proto"
import ExceptionElement, { ExceptionElementProps } from "./ExceptionElement"

const getProps = (
  elementProps: Partial<ExceptionProto> = {}
): ExceptionElementProps => ({
  element: ExceptionProto.create({
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
  const wrapper = mount(<ExceptionElement {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.html()).toMatchSnapshot()
  })

  it("should render the complete stack", () => {
    expect(wrapper.find("StyledStackTraceTitle").text()).toBe("Traceback:")
    const traceRows = wrapper.find("StyledStackTraceRow")
    expect(traceRows.length).toBe(3)

    traceRows.forEach((val, id) => {
      expect(val.prop("children")).toBe(`step ${id + 1}`)
    })
  })

  it("should render markdown when it has messageIsMarkdown", () => {
    const props = getProps({
      messageIsMarkdown: true,
    })
    const wrapper = mount(<ExceptionElement {...props} />)

    expect(wrapper.find(StreamlitMarkdown).length).toBe(1)
    expect(wrapper.find(StreamlitMarkdown).props()).toMatchSnapshot()
  })

  it("should render if there's no message", () => {
    const props = getProps({ message: "" })
    const wrapper = mount(<ExceptionElement {...props} />)

    expect(wrapper.find("div .message").text()).toBe("RuntimeError")
  })
})
