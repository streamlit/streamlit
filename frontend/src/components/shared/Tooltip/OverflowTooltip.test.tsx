import React from "react"
import { shallow } from "enzyme"

import OverflowTooltip from "./OverflowTooltip"
import { Placement } from "./Tooltip"

describe("Tooltip component", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should render and match snapshots when it fits onscreen", () => {
    const useRefSpy = jest.spyOn(React, "useRef").mockReturnValue({
      current: {
        // Pretend the body is greater than its onscreen area.
        offsetWidth: 200,
        scrollWidth: 100,
      },
    })

    jest.spyOn(React, "useEffect").mockImplementation(f => f())

    const wrapper = shallow(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>
    )

    expect(wrapper.props().content).toBe("")

    expect(useRefSpy).toBeCalledWith(null)
    expect(wrapper).toMatchSnapshot()
  })

  it("should render and match snapshots when ellipsized", () => {
    const useRefSpy = jest.spyOn(React, "useRef").mockReturnValue({
      current: {
        // Pretend the body is smaller than its onscreen area.
        offsetWidth: 100,
        scrollWidth: 200,
      },
    })

    jest.spyOn(React, "useEffect").mockImplementation(f => f())

    const wrapper = shallow(
      <OverflowTooltip
        content="the content"
        placement={Placement.AUTO}
        style={{}}
      >
        the child
      </OverflowTooltip>
    )

    expect(wrapper.props().content).toBe("the content")

    expect(useRefSpy).toBeCalledWith(null)
    expect(wrapper).toMatchSnapshot()
  })
})
