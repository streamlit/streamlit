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
import { VEGA_LITE } from "src/lib/mocks/arrow"
import { Quiver } from "src/lib/Quiver"
import { darkTheme, lightTheme } from "src/theme"
import { PropsWithHeight, ArrowVegaLiteChart } from "./ArrowVegaLiteChart"

const MOCK = {
  datasets: [],
  data: new Quiver({
    data: VEGA_LITE,
  }),
  spec: JSON.stringify({
    mark: "circle",
    encoding: {
      x: { field: "a", type: "quantitative" },
      y: { field: "b", type: "quantitative" },
      size: { field: "c", type: "quantitative" },
      color: { field: "c", type: "quantitative" },
    },
  }),
  useContainerWidth: true,
}

const getProps = (props: Partial<PropsWithHeight> = {}): PropsWithHeight => ({
  element: MOCK,
  width: 0,
  height: 0,
  theme: lightTheme.emotion,
  ...props,
})

describe("VegaLiteChart Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<ArrowVegaLiteChart {...props} />)

    expect(wrapper.find("StyledVegaLiteChartContainer").length).toBe(1)
  })

  it("pulls default config values from theme", () => {
    const props = getProps({ theme: darkTheme.emotion })

    const wrapper = mount(<ArrowVegaLiteChart {...props} />)
    // @ts-ignore
    const generatedSpec = wrapper.instance().generateSpec()

    expect(generatedSpec.config.background).toBe(
      darkTheme.emotion.colors.bgColor
    )
    expect(generatedSpec.config.axis.labelColor).toBe(
      darkTheme.emotion.colors.bodyText
    )
  })

  it("has user specified config take priority", () => {
    const props = getProps({ theme: darkTheme.emotion })

    const spec = JSON.parse(props.element.spec)
    spec.config = { background: "purple", axis: { labelColor: "blue" } }

    props.element = {
      ...props.element,
      spec: JSON.stringify(spec),
    }

    const wrapper = mount(<ArrowVegaLiteChart {...props} />)
    // @ts-ignore
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
