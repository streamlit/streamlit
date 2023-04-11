/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { mount } from "src/lib/test_util"
import { Json as JsonProto } from "src/autogen/proto"
import ThemeProvider from "src/components/core/ThemeProvider"
import { darkTheme, baseuiDarkTheme } from "src/theme"
import Json, { JsonProps } from "./Json"

const getProps = (elementProps: Partial<JsonProto> = {}): JsonProps => ({
  element: JsonProto.create({
    body:
      '{ "proper": [1,2,3],' +
      '  "nested": { "thing1": "cat", "thing2": "hat" },' +
      '  "json": "structure" }',
    ...elementProps,
  }),
  width: 100,
})

describe("JSON element", () => {
  it("renders json as expected", () => {
    const props = getProps()
    const wrapper = mount(<Json {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("should show an error with invalid JSON", () => {
    const props = getProps({ body: "invalid JSON" })
    const wrapper = mount(<Json {...props} />)
    expect(wrapper.find("Alert")).toBeDefined()
  })

  it("renders json with NaN and infinity values", () => {
    const props = getProps({
      body: `{
      "numbers":[ -1e27, NaN, Infinity, -Infinity, 2.2822022,-2.2702775],
    }`,
    })
    const wrapper = mount(<Json {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("picks a reasonable theme when the background is light", () => {
    const props = getProps()
    const wrapper = mount(<Json {...props} />)

    expect(wrapper.find('[theme="rjv-default"]').exists()).toBeTruthy()
    expect(wrapper.find('[theme="monokai"]').exists()).toBeFalsy()
  })

  it("picks a reasonable theme when the background is dark", () => {
    const props = getProps()
    const wrapper = mount(
      <ThemeProvider theme={darkTheme.emotion} baseuiTheme={baseuiDarkTheme}>
        <Json {...props} />
      </ThemeProvider>
    )

    expect(wrapper.find('[theme="rjv-default"]').exists()).toBeFalsy()
    expect(wrapper.find('[theme="monokai"]').exists()).toBeTruthy()
  })
})
