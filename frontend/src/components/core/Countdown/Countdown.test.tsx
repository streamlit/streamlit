import React from "react"
import { shallow } from "src/lib/test_util"

import Countdown from "./Countdown"

describe("Countdown Component", () => {
  it("should render without crashing", () => {
    const wrapper = shallow(<Countdown countdown={10} />)

    expect(wrapper.find("span").text()).toBe("10")
  })
})
