import React from "react"
import { ProgressBar as UIProgressBar } from "baseui/progress-bar"
import { mount } from "src/lib/test_util"

import ProgressBar from "./ProgressBar"

describe("ProgressBar component", () => {
  it("renders without crashing", () => {
    const wrapper = mount(<ProgressBar value={50} width={100} />)

    expect(wrapper.find(UIProgressBar).length).toBe(1)
  })

  it("sets the value correctly", () => {
    const wrapper = mount(<ProgressBar value={50} width={100} />)

    expect(wrapper.find(UIProgressBar).prop("value")).toEqual(50)
  })
})
