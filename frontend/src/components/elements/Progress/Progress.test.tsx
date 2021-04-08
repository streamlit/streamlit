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
