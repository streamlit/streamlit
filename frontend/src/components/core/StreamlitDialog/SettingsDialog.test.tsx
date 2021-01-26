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
import { mainTheme, darkTheme } from "theme"
import { mount, shallow } from "lib/test_util"

import { SettingsDialog, Props } from "./SettingsDialog"

const getProps = (extend?: Partial<Props>): Props => ({
  isServerConnected: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  settings: { wideMode: false, runOnSave: false, activeTheme: mainTheme },
  allowRunOnSave: false,
  allowedThemes: [],
  ...extend,
})

describe("SettingsDialog", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<SettingsDialog {...props} />)

    expect(wrapper).toMatchSnapshot()
  })

  it("should render run on save", () => {
    const props = getProps({
      allowRunOnSave: true,
    })

    const wrapper = mount(<SettingsDialog {...props} />)
    const checkboxes = wrapper.find("input[type='checkbox']")

    expect(checkboxes).toHaveLength(2)
    expect(wrapper.state("runOnSave")).toBe(false)

    checkboxes
      .at(0)
      .simulate("change", { target: { name: "runOnSave", checked: true } })
    wrapper.update()

    expect(wrapper.state("runOnSave")).toBe(true)
  })

  it("should render allowedThemes", () => {
    const allowedThemes = [mainTheme, darkTheme]
    const props = getProps({ allowedThemes })
    const wrapper = mount(<SettingsDialog {...props} />)
    const radioBtns = wrapper.find("Radio").slice(1)

    expect(radioBtns).toHaveLength(2)

    const radioLabels = radioBtns.map(btn => btn.prop("children"))
    expect(radioLabels).toEqual(allowedThemes.map(theme => theme.name))

    wrapper
      .find("input[type='radio']")
      .at(1)
      .simulate("change", { target: { value: "1" } })
    wrapper.update()
    expect(wrapper.state("activeTheme")).toEqual(darkTheme)
  })
})
