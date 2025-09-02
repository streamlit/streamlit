/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { screen } from "@testing-library/react"

import {
  emotionLightTheme,
  mockEndpoints,
  render,
  ThemeConfig,
} from "@streamlit/lib"
import { CustomThemeConfig } from "@streamlit/protobuf"

import { SidebarProps } from "./Sidebar"
import ThemedSidebar, { createSidebarTheme } from "./ThemedSidebar"

function getProps(props: Partial<SidebarProps> = {}): SidebarProps {
  return {
    endpoints: mockEndpoints(),
    hasElements: true,
    appPages: [],
    navSections: [],
    onPageChange: vi.fn(),
    currentPageScriptHash: "",
    hideSidebarNav: false,
    expandSidebarNav: false,
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    appLogo: null,
    ...props,
  }
}

describe("ThemedSidebar Component", () => {
  it("should render without crashing", () => {
    render(<ThemedSidebar {...getProps()} />)

    expect(screen.getByTestId("stSidebar")).toBeInTheDocument()
  })

  it("should switch bgColor and secondaryBgColor", () => {
    render(<ThemedSidebar {...getProps()} />)

    expect(screen.getByTestId("stSidebar")).toHaveStyle({
      backgroundColor: emotionLightTheme.colors.secondaryBg,
    })
  })
})

describe("createSidebarTheme", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const createMockTheme = (overrides: any = {}): ThemeConfig => ({
    name: "mockTheme",
    basewebTheme: {},
    primitives: {},
    themeInput: {},
    emotion: {
      colors: {
        secondaryBg: "#FFFFFF",
        bgColor: "#F0F0F0",
      },
    },
    ...overrides,
  })

  it("creates a light theme when background is light", () => {
    const theme = createMockTheme()
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.themeInput?.base).toBe(
      CustomThemeConfig.BaseTheme.LIGHT
    )
  })

  it("creates a dark theme when background is dark", () => {
    const theme = createMockTheme({
      emotion: {
        colors: {
          secondaryBg: "#000000",
          bgColor: "#1A1A1A",
        },
      },
    })
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.themeInput?.base).toBe(
      CustomThemeConfig.BaseTheme.DARK
    )
  })

  it("uses sidebar-specific background color when provided", () => {
    const theme = createMockTheme({
      themeInput: {
        sidebar: {
          backgroundColor: "#FF0000",
        },
      },
    })
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.themeInput?.backgroundColor).toBe("#FF0000")
  })

  it("uses secondary background color as fallback when no sidebar background specified", () => {
    const theme = createMockTheme({
      emotion: {
        colors: {
          secondaryBg: "#CCCCCC",
          bgColor: "#F0F0F0",
        },
      },
    })
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.themeInput?.backgroundColor).toBe("#CCCCCC")
  })

  it("uses secondary background color as fallback when sidebar background is empty string", () => {
    const theme = createMockTheme({
      themeInput: {
        sidebar: {
          backgroundColor: "",
        },
      },
      emotion: {
        colors: {
          secondaryBg: "#CCCCCC",
          bgColor: "#F0F0F0",
        },
      },
    })
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.themeInput?.backgroundColor).toBe("#CCCCCC")
  })

  it("applies sidebar-specific overrides", () => {
    const theme = createMockTheme({
      themeInput: {
        sidebar: {
          primaryColor: "#FF0000",
          backgroundColor: "#00FF00",
        },
      },
    })
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.themeInput?.primaryColor).toBe("#FF0000")
    expect(sidebarTheme.themeInput?.backgroundColor).toBe("#00FF00")
  })

  it("removes empty array properties from sidebar overrides", () => {
    const theme = createMockTheme({
      themeInput: {
        fontFaces: [{ family: "main-font" }],
        headingFontSizes: ["3rem", "2rem"],
        headingFontWeights: [700, 600],
        chartCategoricalColors: ["red", "green", "blue"],
        sidebar: {
          fontFaces: [], // should be removed
          headingFontSizes: [], // special handling, should become default
          headingFontWeights: [], // should be removed
          chartCategoricalColors: [], // should be removed
          chartSequentialColors: ["blue", "green"], // should be kept
          primaryColor: "red", // should be kept
        },
      },
    })
    const sidebarTheme = createSidebarTheme(theme)

    // These properties had empty arrays in the sidebar config. They should be removed
    // from the sidebar-specific overrides, so the final sidebar theme should fall back to
    // the main theme's values for these.
    expect(sidebarTheme.themeInput?.fontFaces).toEqual([
      { family: "main-font" },
    ])
    expect(sidebarTheme.themeInput?.headingFontWeights).toEqual([700, 600])
    expect(sidebarTheme.themeInput?.chartCategoricalColors).toEqual([
      "red",
      "green",
      "blue",
    ])

    // These properties were defined in the sidebar config and should be present.
    expect(sidebarTheme.themeInput?.chartSequentialColors).toEqual([
      "blue",
      "green",
    ])
    expect(sidebarTheme.themeInput?.primaryColor).toBe("red")

    // headingFontSizes has special handling in createSidebarTheme.
    // When the sidebar-specific headingFontSizes is empty, it gets replaced
    // with a default set of values, not the main theme's values.
    expect(sidebarTheme.themeInput?.headingFontSizes).toEqual([
      "1.5rem",
      "1.25rem",
      "1.125rem",
      "1rem",
      "0.875rem",
      "0.75rem",
    ])
  })
})
