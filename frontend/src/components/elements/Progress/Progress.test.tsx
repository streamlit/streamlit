/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { fromJS } from "immutable"
import { timeout } from "lib/utils"

import Progress, { Props, FAST_UPDATE_MS } from "./Progress"
import { Progress as UIProgress } from "reactstrap"

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    value: 50,
    ...elementProps,
  }),
  width: 0,
})

describe("Progress Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<Progress {...props} />)

    expect(wrapper.find(UIProgress).length).toBe(1)
  })

  it("moving backwards", () => {
    const props = getProps()
    const wrapper = shallow(<Progress {...props} />)

    expect(wrapper.instance().lastValue).toBe(50)

    wrapper.setProps({
      element: fromJS({
        value: 49,
      }),
    })

    expect(wrapper.instance().lastValue).toBe(49)
    expect(wrapper.find(UIProgress).prop("value")).toBe(49)
    expect(wrapper.find(UIProgress).prop("className")).toBe(
      "stProgress without-transition"
    )
  })

  it("moving forward", async () => {
    const props = getProps()
    const wrapper = shallow(<Progress {...props} />)

    expect(wrapper.instance().lastValue).toBe(50)

    await timeout(FAST_UPDATE_MS)

    wrapper.setProps({
      element: fromJS({
        value: 51,
      }),
    })

    expect(wrapper.instance().lastValue).toBe(51)
    expect(wrapper.find(UIProgress).prop("value")).toBe(51)
    expect(wrapper.find(UIProgress).prop("className")).toBe(
      "stProgress with-transition"
    )
  })
})
