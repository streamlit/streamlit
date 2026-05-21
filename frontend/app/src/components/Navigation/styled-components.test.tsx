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

import type { CSSProperties } from "react"

import { ThemeProvider as EmotionThemeProvider } from "@emotion/react"
import { screen } from "@testing-library/react"

import { mockTheme } from "@streamlit/lib"
import { render } from "@streamlit/lib/testing"

import SidebarNavLink, { type SidebarNavLinkProps } from "./SidebarNavLink"

const getProps = (
  props: Partial<SidebarNavLinkProps> = {}
): SidebarNavLinkProps => ({
  isActive: false,
  pageUrl: "https://www.example.com",
  icon: "",
  onClick: vi.fn(),
  children: "Test",
  widgetsDisabled: false,
  ...props,
})

const navigationThemeVars = {
  colors: {
    bodyText: "var(--test-nav-body-text)",
    bodyTextDim: "var(--test-nav-body-text-dim)",
    darkenedBgMix15: "var(--test-nav-hover-bg)",
    darkenedBgMix25: "var(--test-nav-active-bg)",
    fadedText40: "var(--test-nav-disabled-text)",
  },
  shadows: {
    focusRing: "var(--test-nav-focus-ring)",
  },
} as const

const nestedSidebarThemeVars = {
  "--test-nav-body-text": "rgb(10, 20, 30)",
  "--test-nav-body-text-dim": "rgba(10, 20, 30, 0.75)",
  "--test-nav-hover-bg": "rgba(151, 166, 195, 0.15)",
  "--test-nav-active-bg": "rgba(151, 166, 195, 0.25)",
  "--test-nav-disabled-text": "rgba(10, 20, 30, 0.4)",
  "--test-nav-focus-ring": "0 0 0 0.2rem rgba(0, 0, 0, 0.25)",
} as CSSProperties

const navigationTheme = {
  ...mockTheme.emotion,
  vars: {
    colors: {
      ...mockTheme.emotion.vars.colors,
      ...navigationThemeVars.colors,
    },
    shadows: {
      ...mockTheme.emotion.vars.shadows,
      ...navigationThemeVars.shadows,
    },
  },
}

function getEmotionStyles(): string {
  return Array.from(document.querySelectorAll("style[data-emotion]"))
    .map(style => style.textContent ?? "")
    .join("\n")
}

describe("Navigation styled components", () => {
  it("uses theme.vars tokens for nav colors and focus ring", () => {
    render(
      <EmotionThemeProvider theme={navigationTheme}>
        <>
          <SidebarNavLink {...getProps({ children: "Inactive" })} />
          <SidebarNavLink
            {...getProps({ isActive: true, children: "Active" })}
          />
          <SidebarNavLink
            {...getProps({ widgetsDisabled: true, children: "Disabled" })}
          />
        </>
      </EmotionThemeProvider>
    )

    const styles = getEmotionStyles()

    expect(styles).toContain(navigationThemeVars.colors.bodyText)
    expect(styles).toContain(navigationThemeVars.colors.bodyTextDim)
    expect(styles).toContain(navigationThemeVars.colors.darkenedBgMix15)
    expect(styles).toContain(navigationThemeVars.colors.darkenedBgMix25)
    expect(styles).toContain(navigationThemeVars.colors.fadedText40)
    expect(styles).toContain(navigationThemeVars.shadows.focusRing)
  })

  it("supports scoped custom properties referenced from theme.vars", () => {
    render(
      <div data-testid="nav-theme-scope" style={nestedSidebarThemeVars}>
        <EmotionThemeProvider theme={navigationTheme}>
          <SidebarNavLink
            {...getProps({ isActive: true, children: "Active" })}
          />
        </EmotionThemeProvider>
      </div>
    )

    const styles = getEmotionStyles()
    const themeScope = screen.getByTestId("nav-theme-scope")
    const themeScopeStyles = window.getComputedStyle(themeScope)

    expect(styles).toContain(navigationThemeVars.colors.darkenedBgMix25)
    expect(
      themeScopeStyles.getPropertyValue("--test-nav-active-bg").trim()
    ).toBe("rgba(151, 166, 195, 0.25)")
  })
})
