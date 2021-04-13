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
import { mount } from "src/lib/test_util"
import { fromJS } from "immutable"
import { VegaLiteChart as VegaLiteChartProto } from "src/autogen/proto"
import { darkTheme, lightTheme } from "src/theme"

import mock from "./mock"
import { PropsWithHeight, VegaLiteChart } from "./VegaLiteChart"

const getProps = (
  elementProps: Partial<VegaLiteChartProto> = {},
  props: Partial<PropsWithHeight> = {}
): PropsWithHeight => ({
  element: fromJS({
    ...mock,
    ...elementProps,
  }),
  width: 0,
  height: 0,
  theme: lightTheme.emotion,
  ...props,
})

describe("VegaLiteChart Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<VegaLiteChart {...props} />)

    expect(wrapper.find("StyledVegaLiteChartContainer").length).toBe(1)
  })

  it("pulls default config values from theme", () => {
    const props = getProps(undefined, { theme: darkTheme.emotion })

    const wrapper = mount(<VegaLiteChart {...props} />)
    const generatedSpec = wrapper.instance().generateSpec()

    expect(generatedSpec.config.background).toBe(
      darkTheme.emotion.colors.bgColor
    )
    expect(generatedSpec.config.axis.labelColor).toBe(
      darkTheme.emotion.colors.bodyText
    )
  })

  it("has user specified config take priority", () => {
    const props = getProps(undefined, { theme: darkTheme.emotion })

    const spec = JSON.parse(props.element.get("spec"))
    spec.config = { background: "purple", axis: { labelColor: "blue" } }

    props.element = fromJS({
      ...props.element.toObject(),
      spec: JSON.stringify(spec),
    })

    const wrapper = mount(<VegaLiteChart {...props} />)
    const generatedSpec = wrapper.instance().generateSpec()

    expect(generatedSpec.config.background).toBe("purple")
    expect(generatedSpec.config.axis.labelColor).toBe("blue")
    // Verify that things not overwritten by the user still fall back to the
    // theme default.
    expect(generatedSpec.config.axis.titleColor).toBe(
      darkTheme.emotion.colors.bodyText
    )
  })
})
