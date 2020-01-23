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

jest.mock("lib/ScreenCastRecorder")

import React, { ComponentType } from "react"
import { shallow } from "enzyme"

import withScreencast from "./withScreencast"
import { ScreencastDialog, UnsupportedBrowserDialog } from "./components"

const testComponent: ComponentType = () => <div>test</div>

describe("withScreencast HOC", () => {
  it("renders without crashing", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("wrapped component should have screenCast prop", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    // @ts-ignore
    expect(wrapper.find(testComponent).props().screenCast).toBeDefined()
  })

  it("it should show a configuration dialog before start recording", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    // @ts-ignore
    wrapper.instance().checkSupportedBrowser = () => true

    // @ts-ignore
    wrapper
      .find(testComponent)
      .props()
      .screenCast.startRecording("screencast-filename")

    expect(wrapper.find(ScreencastDialog).length).toBe(1)
  })

  it("it should show an unsupported dialog", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    // @ts-ignore
    wrapper.instance().checkSupportedBrowser = () => false

    // @ts-ignore
    wrapper
      .find(testComponent)
      .props()
      .screenCast.startRecording("screencast-filename")

    expect(wrapper.find(UnsupportedBrowserDialog).length).toBe(1)
  })
})
