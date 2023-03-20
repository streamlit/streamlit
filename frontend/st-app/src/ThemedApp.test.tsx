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

import {
  LocalStore,
  shallow,
  mount,
  AUTO_THEME_NAME,
  CUSTOM_THEME_NAME,
  createPresetThemes,
  darkTheme,
  setCachedTheme,
  ThemeConfig,
} from "st-lib"

import AppWithScreencast from "./App"
import ThemedApp from "./ThemedApp"

jest.mock("src/lib/ConnectionManager")

describe("ThemedApp", () => {
  beforeEach(() => {
    // sourced from:
    // https://jestjs.io/docs/en/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("renders without crashing", () => {
    const wrapper = mount(<ThemedApp />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("updates theme", () => {
    const wrapper = shallow(<ThemedApp />)
    // @ts-ignore
    wrapper.find(AppWithScreencast).props().theme.setTheme(darkTheme)
    const updatedTheme: ThemeConfig = wrapper.find(AppWithScreencast).props()
      .theme.activeTheme
    expect(updatedTheme.name).toBe("Dark")
    const updatedLocalStorage = JSON.parse(
      window.localStorage.getItem(LocalStore.ACTIVE_THEME) || ""
    )
    expect(updatedLocalStorage.name).toBe("Dark")
  })

  it("does not save Auto theme", () => {
    const wrapper = shallow(<ThemedApp />)
    // @ts-ignore
    wrapper.find(AppWithScreencast).props().theme.setTheme(darkTheme)

    wrapper
      .find(AppWithScreencast)
      .props()
      .theme.setTheme({
        ...darkTheme,
        name: AUTO_THEME_NAME,
      })
    const updatedLocalStorage = window.localStorage.getItem(
      LocalStore.ACTIVE_THEME
    )
    expect(updatedLocalStorage).toBe(null)
  })

  it("updates availableThemes", () => {
    const wrapper = shallow(<ThemedApp />)
    const app = wrapper.find(AppWithScreencast)
    const initialThemes = app.props().theme.availableThemes

    app.props().theme.addThemes([darkTheme])
    app.props().theme.addThemes([darkTheme])

    wrapper.update()
    const newThemes = wrapper.find(AppWithScreencast).props()
      .theme.availableThemes

    // Should only have added one theme despite multiple calls adding themes.
    expect(newThemes.length).toBe(initialThemes.length + 1)
  })

  it("sets the cached theme as the default theme if one is set", () => {
    setCachedTheme(darkTheme)

    const wrapper = shallow(<ThemedApp />)
    const app = wrapper.find(AppWithScreencast)
    const { activeTheme, availableThemes } = app.props().theme

    expect(activeTheme.name).toBe(darkTheme.name)
    expect(availableThemes.length).toBe(createPresetThemes().length)
  })

  it("includes a custom theme as an available theme if one is cached", () => {
    setCachedTheme({
      ...darkTheme,
      name: CUSTOM_THEME_NAME,
    })

    const wrapper = shallow(<ThemedApp />)
    const app = wrapper.find(AppWithScreencast)
    const { activeTheme, availableThemes } = app.props().theme

    expect(activeTheme.name).toBe(CUSTOM_THEME_NAME)
    expect(availableThemes.length).toBe(createPresetThemes().length + 1)
  })

  it("contains the overlay portal required by the interactive table", () => {
    const wrapper = mount(<ThemedApp />)
    expect(wrapper.find("div#portal")).toHaveLength(1)
  })
})
