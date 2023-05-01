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
import { PLACEMENT } from "baseui/tooltip"
import { mount } from "src/lib/test_util"

import Tooltip, { Placement, TooltipProps } from "./Tooltip"

const getProps = (
  propOverrides: Partial<TooltipProps> = {}
): TooltipProps => ({
  placement: Placement.AUTO,
  content: () => {},
  children: null,
  ...propOverrides,
})

describe("Tooltip element", () => {
  it("renders a Tooltip", () => {
    const wrapper = mount(<Tooltip {...getProps()}></Tooltip>)

    expect(wrapper.find("StatefulTooltip").exists()).toBeTruthy()
  })

  it("renders its children", () => {
    const wrapper = mount(
      <Tooltip {...getProps()}>
        <div className="foo" />
      </Tooltip>
    )

    expect(wrapper.find(".foo").exists()).toBeTruthy()
  })

  it("sets its placement", () => {
    const wrapper = mount(
      <Tooltip {...getProps({ placement: Placement.BOTTOM })} />
    )

    expect(wrapper.find("StatefulTooltip").prop("placement")).toEqual(
      PLACEMENT.bottom
    )
  })

  it("sets the same content", () => {
    const content = <span className="foo" />
    const wrapper = mount(<Tooltip {...getProps({ content })} />)

    expect(
      // @ts-expect-error
      wrapper.find("StatefulTooltip").props().content.props.children
    ).toEqual(content)
  })
})
