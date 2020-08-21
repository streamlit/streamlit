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
import { SCSS_VARS } from "autogen/scssVariables"

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
    const wrapper = shallow(<AlertContainer {...getProps()}></AlertContainer>)

    expect(wrapper.find("Notification").exists()).toBeTruthy()
  })

  it("renders its children", () => {
    const wrapper = shallow(
      <AlertContainer {...getProps()}>
        <div className="foo" />
      </AlertContainer>
    )

    expect(wrapper.find(".foo").exists()).toBeTruthy()
  })

  it("sets its width", () => {
    const wrapper = shallow(<AlertContainer {...getProps()} />)

    const overrides = wrapper.find("Notification").prop("overrides")

    // @ts-ignore
    expect(overrides.Body.style.width).toEqual(100)
  })

  it("sets border color correctly for info", () => {
    const wrapper = shallow(<AlertContainer {...getProps()} />)

    const overrides = wrapper.find("Notification").prop("overrides")

    // @ts-ignore
    expect(overrides.Body.style.border).toContain(
      SCSS_VARS["$alert-info-border-color"]
    )
  })

  it("sets border color correctly for positive", () => {
    const wrapper = shallow(
      <AlertContainer {...getProps({ kind: Kind.SUCCESS })} />
    )

    const overrides = wrapper.find("Notification").prop("overrides")

    // @ts-ignore
    expect(overrides.Body.style.border).toContain(
      SCSS_VARS["$alert-success-border-color"]
    )
  })

  it("sets border color correctly for warning", () => {
    const wrapper = shallow(
      <AlertContainer {...getProps({ kind: Kind.WARNING })} />
    )

    const overrides = wrapper.find("Notification").prop("overrides")

    // @ts-ignore
    expect(overrides.Body.style.border).toContain(
      SCSS_VARS["$alert-warning-border-color"]
    )
  })

  it("sets border color correctly for negative", () => {
    const wrapper = shallow(
      <AlertContainer {...getProps({ kind: Kind.ERROR })} />
    )

    const overrides = wrapper.find("Notification").prop("overrides")

    // @ts-ignore
    expect(overrides.Body.style.border).toContain(
      SCSS_VARS["$alert-error-border-color"]
    )
  })
})
