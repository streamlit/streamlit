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
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, Mock, vi } from "vitest"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  AUTO_THEME_NAME,
  createAutoTheme,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  CUSTOM_THEME_NAME,
  darkTheme,
  lightTheme,
  mockSessionInfo,
  ThemeConfig,
} from "@streamlit/lib"
import { renderWithContexts } from "@streamlit/lib/testing"

import ThemeSwitcher, { ThemeSwitcherProps } from "./ThemeSwitcher"

const getProps = (): ThemeSwitcherProps => ({
  metricsMgr: new MetricsManager(mockSessionInfo()),
})

const customLightTheme: ThemeConfig = {
  ...lightTheme,
  name: CUSTOM_THEME_LIGHT_NAME,
  displayName: "Light",
}

const customDarkTheme: ThemeConfig = {
  ...darkTheme,
  name: CUSTOM_THEME_DARK_NAME,
  displayName: "Dark",
}

const customAutoTheme: ThemeConfig = {
  ...createAutoTheme(),
  name: CUSTOM_THEME_AUTO_NAME,
  displayName: AUTO_THEME_NAME,
}

const singleCustomTheme: ThemeConfig = {
  ...lightTheme,
  name: CUSTOM_THEME_NAME,
  displayName: CUSTOM_THEME_NAME,
}

describe("ThemeSwitcher", () => {
  let mockSetTheme: Mock<(theme: ThemeConfig) => void>
  let autoTheme: ThemeConfig

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetTheme = vi.fn<(theme: ThemeConfig) => void>()
    autoTheme = createAutoTheme()
  })

  it("renders three theme options: System, Light, Dark", () => {
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: autoTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    expect(screen.getByTestId("stThemeSwitcher")).toBeVisible()
    expect(screen.getByTestId("stThemeSwitcher-System")).toBeVisible()
    expect(screen.getByTestId("stThemeSwitcher-Light")).toBeVisible()
    expect(screen.getByTestId("stThemeSwitcher-Dark")).toBeVisible()
  })

  it("shows System as active when auto theme is selected", () => {
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: autoTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    expect(screen.getByTestId("stThemeSwitcher-System")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByTestId("stThemeSwitcher-Light")).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(screen.getByTestId("stThemeSwitcher-Dark")).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("shows Light as active when light theme is selected", () => {
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: lightTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    expect(screen.getByTestId("stThemeSwitcher-Light")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("shows Dark as active when dark theme is selected", () => {
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: darkTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    expect(screen.getByTestId("stThemeSwitcher-Dark")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("calls setTheme with light theme when Light button is clicked", async () => {
    const user = userEvent.setup()
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: autoTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    await user.click(screen.getByTestId("stThemeSwitcher-Light"))

    expect(mockSetTheme).toHaveBeenCalledWith(lightTheme)
  })

  it("calls setTheme with dark theme when Dark button is clicked", async () => {
    const user = userEvent.setup()
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: autoTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    await user.click(screen.getByTestId("stThemeSwitcher-Dark"))

    expect(mockSetTheme).toHaveBeenCalledWith(darkTheme)
  })

  it("calls setTheme with auto theme when System button is clicked", async () => {
    const user = userEvent.setup()
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: lightTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    await user.click(screen.getByTestId("stThemeSwitcher-System"))

    expect(mockSetTheme).toHaveBeenCalledWith(autoTheme)
  })

  describe("with custom themes", () => {
    it("calls setTheme with custom auto theme when System button is clicked", async () => {
      const user = userEvent.setup()
      renderWithContexts(<ThemeSwitcher {...getProps()} />, {
        themeContext: {
          activeTheme: customLightTheme,
          availableThemes: [
            customLightTheme,
            customDarkTheme,
            customAutoTheme,
          ],
          setTheme: mockSetTheme,
        },
      })

      await user.click(screen.getByTestId("stThemeSwitcher-System"))

      expect(mockSetTheme).toHaveBeenCalledWith(customAutoTheme)
    })

    it("calls setTheme with custom light theme when Light button is clicked", async () => {
      const user = userEvent.setup()
      renderWithContexts(<ThemeSwitcher {...getProps()} />, {
        themeContext: {
          activeTheme: customAutoTheme,
          availableThemes: [
            customLightTheme,
            customDarkTheme,
            customAutoTheme,
          ],
          setTheme: mockSetTheme,
        },
      })

      await user.click(screen.getByTestId("stThemeSwitcher-Light"))

      expect(mockSetTheme).toHaveBeenCalledWith(customLightTheme)
    })

    it("calls setTheme with custom dark theme when Dark button is clicked", async () => {
      const user = userEvent.setup()
      renderWithContexts(<ThemeSwitcher {...getProps()} />, {
        themeContext: {
          activeTheme: customAutoTheme,
          availableThemes: [
            customLightTheme,
            customDarkTheme,
            customAutoTheme,
          ],
          setTheme: mockSetTheme,
        },
      })

      await user.click(screen.getByTestId("stThemeSwitcher-Dark"))

      expect(mockSetTheme).toHaveBeenCalledWith(customDarkTheme)
    })
  })

  it("disables Light and Dark when only a single custom theme is available", () => {
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: singleCustomTheme,
        availableThemes: [singleCustomTheme],
        setTheme: mockSetTheme,
      },
    })

    expect(screen.getByTestId("stThemeSwitcher-System")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByTestId("stThemeSwitcher-Light")).toBeDisabled()
    expect(screen.getByTestId("stThemeSwitcher-Dark")).toBeDisabled()
  })

  it("does not call setTheme if theme not found", async () => {
    const user = userEvent.setup()
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: lightTheme,
        availableThemes: [lightTheme, darkTheme],
        setTheme: mockSetTheme,
      },
    })

    await user.click(screen.getByTestId("stThemeSwitcher-System"))

    expect(mockSetTheme).not.toHaveBeenCalled()
  })
})
