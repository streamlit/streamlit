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
import { mount, shallow } from "src/lib/test_util"
import { LabelVisibilityOptions } from "src/lib/util/utils"
import StreamlitMarkdown from "src/lib/components/shared/StreamlitMarkdown"

import { WidgetLabel, LabelProps } from "./WidgetLabel"

const getProps = (props?: Partial<LabelProps>): LabelProps => ({
  label: "Label",
  ...props,
})

describe("Widget Label", () => {
  it("renders WidgetLabel as expected", () => {
    const props = getProps()
    const wrapper = shallow(<WidgetLabel {...props} />)

    expect(wrapper).toMatchSnapshot()
  })

  it("renders label text as expected", () => {
    const props = getProps()
    const wrapper = mount(<WidgetLabel {...props} />)
    const labelMarkdown = wrapper.find(StreamlitMarkdown)

    expect(wrapper.props().label).toBe(getProps().label)
    expect(labelMarkdown.props().isLabel).toBe(true)
  })

  it("can be disabled", () => {
    const props = getProps({ disabled: true })
    const wrapper = mount(<WidgetLabel {...props} />)

    expect(wrapper.props().disabled).toBe(true)
  })

  it("can hide label visibility", () => {
    const props = getProps({ labelVisibility: LabelVisibilityOptions.Hidden })
    const wrapper = mount(<WidgetLabel {...props} />)

    expect(wrapper.props().labelVisibility).toEqual(
      LabelVisibilityOptions.Hidden
    )
  })
})
