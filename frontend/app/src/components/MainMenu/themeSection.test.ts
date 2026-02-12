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
  it("returns the preset auto theme for 'System'", () => {
    const result = findThemeForSelection("System", defaultAvailableThemes)
    expect(result).toBe(autoTheme)
  })

  it("returns the custom auto theme for 'System' when available", () => {
    const themes = [customAutoTheme, lightTheme, darkTheme]
    const result = findThemeForSelection("System", themes)
    expect(result).toBe(customAutoTheme)
  })

  it("returns the preset light theme for 'Light'", () => {
    const result = findThemeForSelection("Light", defaultAvailableThemes)
    expect(result).toBe(lightTheme)
  })

  it("returns the custom light theme for 'Light' when available", () => {
    const themes = [autoTheme, customLightTheme, darkTheme]
    const result = findThemeForSelection("Light", themes)
    expect(result).toBe(customLightTheme)
  })

  it("returns the preset dark theme for 'Dark'", () => {
    const result = findThemeForSelection("Dark", defaultAvailableThemes)
    expect(result).toBe(darkTheme)
  })

  it("returns the custom dark theme for 'Dark' when available", () => {
    const themes = [autoTheme, lightTheme, customDarkTheme]
    const result = findThemeForSelection("Dark", themes)
    expect(result).toBe(customDarkTheme)
  })

  it("returns undefined when no matching theme exists", () => {
    const themes = [singleCustomTheme]
    expect(findThemeForSelection("System", themes)).toBeUndefined()
    expect(findThemeForSelection("Light", themes)).toBeUndefined()
    expect(findThemeForSelection("Dark", themes)).toBeUndefined()
  })
})

describe("buildThemeSection", () => {
  it("returns 3 radio items with preset themes", () => {
    const items = buildThemeSection(
      autoTheme,
      defaultAvailableThemes,
      vi.fn(),
      makeMetricsMgr()
    )

    expect(items).toHaveLength(3)
    expect(items.map(i => i.label)).toEqual(["System", "Light", "Dark"])
    expect(items.every(i => i.type === "radio")).toBe(true)
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

  it("marks the active theme as checked (System)", () => {
    const items = buildThemeSection(
      autoTheme,
      defaultAvailableThemes,
      vi.fn(),
      makeMetricsMgr()
    )

    const checked = items.filter(i => i.type === "radio" && i.checked)
    expect(checked).toHaveLength(1)
    expect(checked[0].label).toBe("System")
  })

  it("marks the active theme as checked (Light)", () => {
    const items = buildThemeSection(
      lightTheme,
      defaultAvailableThemes,
      vi.fn(),
      makeMetricsMgr()
    )

    const checked = items.filter(i => i.type === "radio" && i.checked)
    expect(checked).toHaveLength(1)
    expect(checked[0].label).toBe("Light")
  })

  it("marks the active theme as checked (Dark)", () => {
    const items = buildThemeSection(
      darkTheme,
      defaultAvailableThemes,
      vi.fn(),
      makeMetricsMgr()
    )

    const checked = items.filter(i => i.type === "radio" && i.checked)
    expect(checked).toHaveLength(1)
    expect(checked[0].label).toBe("Dark")
  })

  it("sets correct keys and icons on items", () => {
    const items = buildThemeSection(
      autoTheme,
      defaultAvailableThemes,
      vi.fn(),
      makeMetricsMgr()
    )

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

  it("onSelect calls setTheme with the matching theme", () => {
    const setTheme = vi.fn()
    const items = buildThemeSection(
      autoTheme,
      defaultAvailableThemes,
      setTheme,
      makeMetricsMgr()
    )

    // Click the Dark radio
    const darkItem = items.find(i => i.label === "Dark")
    expect(darkItem).toBeDefined()
    if (darkItem?.type === "radio") {
      darkItem.onSelect()
    }

    expect(setTheme).toHaveBeenCalledWith(darkTheme)
  })

  it("onSelect enqueues metrics", () => {
    const metricsMgr = makeMetricsMgr()
    const enqueueSpy = vi.spyOn(metricsMgr, "enqueue")
    const items = buildThemeSection(
      autoTheme,
      defaultAvailableThemes,
      vi.fn(),
      metricsMgr
    )

    const lightItem = items.find(i => i.label === "Light")
    if (lightItem?.type === "radio") {
      lightItem.onSelect()
    }

    expect(enqueueSpy).toHaveBeenCalledWith("menuClick", {
      label: "changeTheme",
    })
  })

  it("onSelect does not call setTheme when no matching theme found", () => {
    // Create a scenario where preset themes are available but findThemeForSelection
    // won't match: e.g., only a single non-matching custom theme
    const oddTheme: ThemeConfig = {
      ...lightTheme,
      name: "SomethingElse",
    }
    const setTheme = vi.fn()
    const items = buildThemeSection(
      oddTheme,
      [oddTheme],
      setTheme,
      makeMetricsMgr()
    )

    // Items are generated because oddTheme doesn't match CUSTOM_THEME_NAME
    expect(items).toHaveLength(3)

    // Clicking any radio should not call setTheme (no matching theme)
    for (const item of items) {
      if (item.type === "radio") {
        item.onSelect()
      }
    }
    expect(setTheme).not.toHaveBeenCalled()
  })
})
