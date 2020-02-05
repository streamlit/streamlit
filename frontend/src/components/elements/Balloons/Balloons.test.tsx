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
import { Balloons as BalloonsProto } from "autogen/proto"

import Balloons, { Props } from "./Balloons"

const getProps = (): Props => ({
  element: fromJS({
    type: BalloonsProto.Type.DEFAULT,
    executionId: 51522269,
  }),
  width: 0,
})

describe("Balloons element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<Balloons {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find(".balloons img").length).toBe(15)

    wrapper.find(".balloons img").forEach(node => {
      expect(node.prop("src")).toBeTruthy()
      expect(node.prop("style")).toHaveProperty("left")
      expect(node.prop("style")).toHaveProperty("animationDelay")
    })
  })
})
