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
import { shallow } from "lib/test_util"
import { fromJS } from "immutable"
import { VegaLiteChart as VegaLiteChartProto } from "autogen/proto"

import mock from "./mock"
import { PropsWithHeight, VegaLiteChart } from "./VegaLiteChart"

const getProps = (
  elementProps: Partial<VegaLiteChartProto> = {}
): PropsWithHeight => ({
  element: fromJS({
    ...mock,
    ...elementProps,
  }),
  width: 0,
  height: 0,
})

describe("VegaLiteChart Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<VegaLiteChart {...props} />)

    expect(wrapper.find("StyledVegaLiteChartContainer").length).toBe(1)
  })
})
