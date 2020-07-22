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
import { fromJS } from "immutable"
import { useHotkeys } from "react-hotkeys-hook"
import { WidgetStateManager } from "lib/WidgetStateManager"

import HotKey, { Props } from "./Hotkey"

jest.mock("lib/WidgetStateManager")
jest.mock("react-hotkeys-hook")

const sendBackMsg = jest.fn()

const getProps = (): Props => ({
  element: fromJS({
    id: 1,
    keys: "ctrl+k",
  }),
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("HotKey widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<HotKey {...props} />)

    expect(wrapper).toBeDefined()
    expect(useHotkeys).toHaveBeenCalled()
  })
})
