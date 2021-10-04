/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import OverflowTooltip from "./OverflowTooltip"

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
      <OverflowTooltip content="the content">the child</OverflowTooltip>
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
      <OverflowTooltip content="the content">the child</OverflowTooltip>
    )

    expect(wrapper.props().content).toBe("the content")

    expect(useRefSpy).toBeCalledWith(null)
    expect(wrapper).toMatchSnapshot()
  })
})
