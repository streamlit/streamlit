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

import { screen } from "@testing-library/react"

import {
  createSidebarTheme,
  createTheme,
  emotionLightTheme,
  mockEndpoints,
  mockTheme,
  type ThemeConfig,
} from "@streamlit/lib"
import { renderWithContexts } from "@streamlit/lib/testing"
import { CustomThemeConfig } from "@streamlit/protobuf"

import type { SidebarProps } from "./Sidebar"
import ThemedSidebar from "./ThemedSidebar"

function getProps(props: Partial<SidebarProps> = {}): SidebarProps {
  return {
    endpoints: mockEndpoints(),
    hasElements: true,
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    widgetsDisabled: false,
    ...props,
  }
}

// Helper to render ThemedSidebar with default context values
function renderThemedSidebar(
  props: Partial<SidebarProps> = {}
): ReturnType<typeof renderWithContexts> {
  return renderWithContexts(<ThemedSidebar {...getProps(props)} />)
}

describe("ThemedSidebar Component", () => {
  it("should render without crashing", () => {
    renderThemedSidebar()

    expect(screen.getByTestId("stSidebar")).toBeInTheDocument()
  })

  it("should switch bgColor and secondaryBgColor", () => {
    renderThemedSidebar()

    expect(screen.getByTestId("stSidebar")).toHaveStyle({
      backgroundColor: emotionLightTheme.colors.secondaryBg,
    })
  })

  describe("configured padding (theme.paddingTop / theme.paddingBottom)", () => {
    const SAMPLE_PAGES = [
      { pageName: "first_page", pageScriptHash: "page_hash" },
      { pageName: "second_page", pageScriptHash: "page_hash2" },
    ]

    const getSidebarUserContentStyle = (): CSSStyleDeclaration =>
      window.getComputedStyle(screen.getByTestId("stSidebarUserContent"))

    const getSidebarHeaderStyle = (): CSSStyleDeclaration =>
      window.getComputedStyle(screen.getByTestId("stSidebarHeader"))

    const renderWithPaddingTheme = (
      themeOverrides: { paddingTop?: string; paddingBottom?: string },
      navigationContext?: {
        appPages: Array<{ pageName: string; pageScriptHash: string }>
      }
    ): ReturnType<typeof renderWithContexts> => {
      const customTheme = createTheme("Custom", themeOverrides)
      return renderWithContexts(<ThemedSidebar {...getProps()} />, {
        themeContext: {
          activeTheme: customTheme,
          setTheme: vi.fn(),
          availableThemes: [],
        },
        navigationContext,
      })
    }

    it("uses configured paddingBottom on stSidebarUserContent", () => {
      renderWithPaddingTheme({ paddingBottom: "3rem" })
      const style = getSidebarUserContentStyle()
      expect(style.paddingBottom).toBe("3rem")
    })

    it("falls back to sidebarTopSpace when paddingBottom is not configured", () => {
      renderThemedSidebar()
      const style = getSidebarUserContentStyle()
      // Default sidebarTopSpace from mock theme
      expect(style.paddingBottom).toBe(mockTheme.emotion.sizes.sidebarTopSpace)
    })

    it("puts configured paddingTop on header marginBottom when there is no page nav", () => {
      renderWithPaddingTheme(
        { paddingTop: "2rem" },
        {
          appPages: [
            { pageName: "streamlit_app", pageScriptHash: "page_hash" },
          ],
        }
      )
      expect(getSidebarHeaderStyle().marginBottom).toBe("2rem")
      expect(getSidebarUserContentStyle().paddingTop).toBe("0px")
    })

    it("puts configured paddingTop on user-content when page nav is shown", () => {
      renderWithPaddingTheme(
        { paddingTop: "2rem" },
        {
          appPages: SAMPLE_PAGES,
        }
      )
      // Header→nav spacing stays at spacing.lg; gap is on user-content
      expect(getSidebarHeaderStyle().marginBottom).toBe(
        mockTheme.emotion.spacing.lg
      )
      expect(getSidebarUserContentStyle().paddingTop).toBe("2rem")
    })

    it("keeps unset header marginBottom and user-content padding for page nav", () => {
      renderWithContexts(<ThemedSidebar {...getProps()} />, {
        navigationContext: { appPages: SAMPLE_PAGES },
      })
      expect(getSidebarHeaderStyle().marginBottom).toBe(
        mockTheme.emotion.spacing.lg
      )
      expect(getSidebarUserContentStyle().paddingTop).toBe(
        mockTheme.emotion.spacing.twoXL
      )
    })

    it("keeps unset header marginBottom and zero user-content padding without page nav", () => {
      renderThemedSidebar()
      expect(getSidebarHeaderStyle().marginBottom).toBe(
        mockTheme.emotion.spacing.lg
      )
      expect(getSidebarUserContentStyle().paddingTop).toBe("0px")
    })
  })
})

describe("createSidebarTheme", () => {
  const createMockTheme = (
    overrides: Record<string, unknown> = {}
  ): ThemeConfig =>
    ({
      name: "mockTheme",
      themeInput: {},
      emotion: {
        colors: {
          secondaryBg: "#FFFFFF",
          bgColor: "#F0F0F0",
        },
      },
      ...overrides,
    }) as ThemeConfig

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

  it("propagates paddingTop and paddingBottom to sidebar theme", () => {
    const theme = createTheme("Custom", {
      paddingTop: "1rem",
      paddingBottom: "2rem",
    })
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.emotion.paddingTop).toBe("1rem")
    expect(sidebarTheme.emotion.paddingBottom).toBe("2rem")
  })

  it("propagates paddingTop and paddingBottom when set on [theme.sidebar]", () => {
    // sidebar-specific overrides win over main-theme values
    const theme = createTheme("Custom", {
      paddingTop: "1rem",
      paddingBottom: "2rem",
      sidebar: { paddingTop: "3rem", paddingBottom: "4rem" },
    })
    const sidebarTheme = createSidebarTheme(theme)
    expect(sidebarTheme.emotion.paddingTop).toBe("3rem")
    expect(sidebarTheme.emotion.paddingBottom).toBe("4rem")
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
