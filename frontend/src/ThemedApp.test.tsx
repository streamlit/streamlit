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
import { shallow, mount } from "lib/test_util"
import { darkTheme, ThemeConfig } from "theme"
import { LocalStore } from "lib/storageUtils"
import ThemedApp from "./ThemedApp"
import AppWithScreencast from "./App"

describe("ThemedApp", () => {
  it("renders without crashing", () => {
    const wrapper = mount(<ThemedApp />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("updates theme", () => {
    const wrapper = shallow(<ThemedApp />)
    // @ts-ignore
    wrapper
      .find(AppWithScreencast)
      .props()
      .theme.setTheme(darkTheme)
    const updatedTheme: ThemeConfig = wrapper.find(AppWithScreencast).props()
      .theme.activeTheme
    expect(updatedTheme.name).toBe("Dark")
    const updatedLocalStorage = JSON.parse(
      window.localStorage.getItem(LocalStore.ACTIVE_THEME) || ""
    )
    expect(updatedLocalStorage.name).toBe("Dark")
  })
})
