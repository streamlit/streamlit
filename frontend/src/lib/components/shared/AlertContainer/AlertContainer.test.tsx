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

import AlertContainer, { AlertContainerProps, Kind } from "./AlertContainer"

const getProps = (
  propOverrides: Partial<AlertContainerProps> = {}
): AlertContainerProps => ({
  kind: Kind.INFO,
  width: 100,
  children: null,
  ...propOverrides,
})

describe("AlertContainer element", () => {
  it("renders a Notification", () => {
    const wrapper = mount(<AlertContainer {...getProps()}></AlertContainer>)

    expect(wrapper.find("Notification").exists()).toBeTruthy()
  })

  it("renders its children", () => {
    const wrapper = mount(
      <AlertContainer {...getProps()}>
        <div className="foo" />
      </AlertContainer>
    )

    expect(wrapper.find(".foo").exists()).toBeTruthy()
  })

  it("sets its width", () => {
    const wrapper = mount(<AlertContainer {...getProps()} />)

    const overrides = wrapper.find("Notification").prop("overrides")

    // @ts-expect-error
    expect(overrides.Body.style.width).toEqual("100")
  })
})
