/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  AUTO_THEME_NAME,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  CUSTOM_THEME_NAME,
  darkTheme,
  lightTheme,
  mockSessionInfo,
  ThemeConfig,
} from "@streamlit/lib"

import { buildThemeSection, findThemeForSelection } from "./themeSection"

// Minimal auto theme for testing (reuses lightTheme's internals)
const autoTheme: ThemeConfig = {
  ...lightTheme,
  name: AUTO_THEME_NAME,
}

const customAutoTheme: ThemeConfig = {
  ...lightTheme,
  name: CUSTOM_THEME_AUTO_NAME,
}

const customLightTheme: ThemeConfig = {
  ...lightTheme,
  name: CUSTOM_THEME_LIGHT_NAME,
}

const customDarkTheme: ThemeConfig = {
  ...darkTheme,
  name: CUSTOM_THEME_DARK_NAME,
}

const singleCustomTheme: ThemeConfig = {
  ...lightTheme,
  name: CUSTOM_THEME_NAME,
}

const defaultAvailableThemes = [autoTheme, lightTheme, darkTheme]

function makeMetricsMgr(): MetricsManager {
  return new MetricsManager(mockSessionInfo())
}

describe("findThemeForSelection", () => {
  it.each([
    ["System", defaultAvailableThemes, autoTheme],
    ["Light", defaultAvailableThemes, lightTheme],
    ["Dark", defaultAvailableThemes, darkTheme],
    ["System", [customAutoTheme, lightTheme, darkTheme], customAutoTheme],
    ["Light", [autoTheme, customLightTheme, darkTheme], customLightTheme],
    ["Dark", [autoTheme, lightTheme, customDarkTheme], customDarkTheme],
  ] as const)(
    "returns the correct theme for '%s' (prefers custom variant)",
    (selection, themes, expected) => {
      expect(findThemeForSelection(selection, [...themes])).toBe(expected)
    }
  )

  it("returns undefined when no matching theme exists", () => {
    const themes = [singleCustomTheme]
    expect(findThemeForSelection("System", themes)).toBeUndefined()
    expect(findThemeForSelection("Light", themes)).toBeUndefined()
    expect(findThemeForSelection("Dark", themes)).toBeUndefined()
  })
})

describe("buildThemeSection", () => {
  it("returns 3 radio items with correct labels, keys, and icons", () => {
    const items = buildThemeSection(
      autoTheme,
      defaultAvailableThemes,
      vi.fn(),
      makeMetricsMgr()
    )

    expect(items).toHaveLength(3)
    expect(items.every(i => i.type === "radio")).toBe(true)
    expect(items.map(i => i.label)).toEqual(["System", "Light", "Dark"])
    expect(items[0]).toMatchObject({
      key: "theme-System",
      icon: ":material/contrast:",
    })
    expect(items[1]).toMatchObject({
      key: "theme-Light",
      icon: ":material/light_mode:",
    })
    expect(items[2]).toMatchObject({
      key: "theme-Dark",
      icon: ":material/dark_mode:",
    })
  })

  it("returns [] when availableThemes is empty", () => {
    const items = buildThemeSection(autoTheme, [], vi.fn(), makeMetricsMgr())

    expect(items).toEqual([])
  })

  it("returns [] when only a single custom theme (no light/dark variants)", () => {
    const items = buildThemeSection(
      singleCustomTheme,
      [singleCustomTheme],
      vi.fn(),
      makeMetricsMgr()
    )

    expect(items).toEqual([])
  })

  it("returns items when custom theme has light/dark variants", () => {
    const themes = [customAutoTheme, customLightTheme, customDarkTheme]
    const items = buildThemeSection(
      customAutoTheme,
      themes,
      vi.fn(),
      makeMetricsMgr()
    )

    expect(items).toHaveLength(3)
  })

  it.each([
    ["System", autoTheme],
    ["Light", lightTheme],
    ["Dark", darkTheme],
  ] as const)(
    "marks %s as the only checked item when active",
    (label, theme) => {
      const items = buildThemeSection(
        theme,
        defaultAvailableThemes,
        vi.fn(),
        makeMetricsMgr()
      )

      const checked = items.filter(i => i.type === "radio" && i.checked)
      expect(checked).toHaveLength(1)
      expect(checked[0].label).toBe(label)
    }
  )

  it("onSelect calls setTheme and enqueues metrics", () => {
    const setTheme = vi.fn()
    const metricsMgr = makeMetricsMgr()
    const enqueueSpy = vi.spyOn(metricsMgr, "enqueue")
    const items = buildThemeSection(
      autoTheme,
      defaultAvailableThemes,
      setTheme,
      metricsMgr
    )

    const darkItem = items.find(i => i.label === "Dark")
    expect(darkItem).toBeDefined()
    if (darkItem?.type === "radio") {
      darkItem.onSelect()
    }

    expect(setTheme).toHaveBeenCalledWith(darkTheme)
    expect(enqueueSpy).toHaveBeenCalledWith("menuClick", {
      label: "changeTheme",
    })
  })

  it("returns [] when only a single theme is available", () => {
    const oddTheme: ThemeConfig = {
      ...lightTheme,
      name: "SomethingElse",
    }
    const items = buildThemeSection(
      oddTheme,
      [oddTheme],
      vi.fn(),
      makeMetricsMgr()
    )

    // Nothing to switch between with a single theme
    expect(items).toHaveLength(0)
  })
})
