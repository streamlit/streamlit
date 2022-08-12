import React from "react"
import { shallow } from "src/lib/test_util"

import { Progress as ProgressProto } from "src/autogen/proto"
import Progress, { ProgressProps } from "./Progress"

const getProps = (
  propOverrides: Partial<ProgressProps> = {}
): ProgressProps => ({
  element: ProgressProto.create({
    value: 50,
  }),
  width: 0,
  ...propOverrides,
})

describe("ProgressBar component", () => {
  it("renders without crashing", () => {
    const wrapper = shallow(<Progress {...getProps()} />)

    expect(wrapper.find("ProgressBar").length).toBe(1)
  })

  it("sets the value and width correctly", () => {
    const wrapper = shallow(<Progress {...getProps({ width: 100 })} />)

    expect(wrapper.find("ProgressBar").prop("value")).toEqual(50)
    expect(wrapper.find("ProgressBar").prop("width")).toEqual(100)
  })
})
