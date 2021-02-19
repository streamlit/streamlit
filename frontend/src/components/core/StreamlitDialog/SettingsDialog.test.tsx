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
import { lightTheme, darkTheme } from "theme"
import { mount, shallow } from "lib/test_util"
import UISelectbox from "components/shared/Dropdown"

import { SettingsDialog, Props } from "./SettingsDialog"

const getProps = (extend?: Partial<Props>): Props => ({
  isServerConnected: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  settings: { wideMode: false, runOnSave: false, activeTheme: lightTheme },
  allowRunOnSave: false,
  allowedThemes: [],
  ...extend,
})

describe("SettingsDialog", () => {
  it("renders without crashing", () => {
    const allowedThemes = [lightTheme, darkTheme]
    const props = getProps({ allowedThemes })
    const wrapper = shallow(<SettingsDialog {...props} />)

    expect(wrapper).toMatchSnapshot()
  })

  it("should render run on save checkbox", () => {
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
    expect(props.onSave).toHaveBeenCalled()
    // @ts-ignore
    expect(props.onSave.mock.calls[0][0].runOnSave).toBe(true)
  })

  it("should render wide mode checkbox", () => {
    const props = getProps()

    const wrapper = mount(<SettingsDialog {...props} />)
    const checkboxes = wrapper.find("input[type='checkbox']")

    expect(checkboxes).toHaveLength(1)
    expect(wrapper.state("wideMode")).toBe(false)

    checkboxes
      .at(0)
      .simulate("change", { target: { name: "wideMode", checked: true } })
    wrapper.update()

    expect(wrapper.state("wideMode")).toBe(true)
    expect(props.onSave).toHaveBeenCalled()
    // @ts-ignore
    expect(props.onSave.mock.calls[0][0].wideMode).toBe(true)
  })

  it("should render theme selector", () => {
    const allowedThemes = [lightTheme, darkTheme]
    const props = getProps({ allowedThemes })
    const wrapper = mount(<SettingsDialog {...props} />)
    const selectbox = wrapper.find(UISelectbox)
    const { options } = selectbox.props()

    expect(options).toHaveLength(2)

    expect(options).toEqual(allowedThemes.map(theme => theme.name))

    selectbox.prop("onChange")(1)
    wrapper.update()
    expect(wrapper.state("activeTheme")).toEqual(darkTheme)
    expect(props.onSave).toHaveBeenCalled()
    // @ts-ignore
    expect(props.onSave.mock.calls[0][0].activeTheme).toBe(darkTheme)
  })
})
