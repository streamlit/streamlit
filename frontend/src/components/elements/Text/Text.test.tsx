import React from "react"
import { shallow } from "src/lib/test_util"
import { Text as TextProto } from "src/autogen/proto"
import Text, { TextProps } from "./Text"

const getProps = (elementProps: Partial<TextProto> = {}): TextProps => ({
  element: TextProto.create({
    body: "some plain text",
    ...elementProps,
  }),
  width: 100,
})

describe("Text element", () => {
  it("renders preformatted text as expected", () => {
    const props = getProps()
    const wrap = shallow(<Text {...props} />)
    expect(wrap).toBeDefined()
    expect(wrap.text()).toBe("some plain text")
  })
})
