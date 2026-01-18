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
import { describe, expect, it, vi } from "vitest"

import {
  AUTO_THEME_NAME,
  createAutoTheme,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  darkTheme,
  lightTheme,
  ThemeConfig,
} from "@streamlit/lib"
import { renderWithContexts } from "@streamlit/lib/testing"

import ThemeSwitcher, { ThemeSwitcherProps } from "./ThemeSwitcher"

const mockMetricsMgr = {
  enqueue: vi.fn(),
}

const getProps = (
  props: Partial<ThemeSwitcherProps> = {}
): ThemeSwitcherProps => ({
  metricsMgr: mockMetricsMgr as any,
  ...props,
})

// Create custom theme configs for testing
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

describe("ThemeSwitcher", () => {
  let mockSetTheme: ReturnType<typeof vi.fn>
  let autoTheme: ThemeConfig

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetTheme = vi.fn()
    // Create a fresh auto theme for each test
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

    const systemButton = screen.getByTestId("stThemeSwitcher-System")
    expect(systemButton).toHaveAttribute("aria-pressed", "true")

    const lightButton = screen.getByTestId("stThemeSwitcher-Light")
    expect(lightButton).toHaveAttribute("aria-pressed", "false")

    const darkButton = screen.getByTestId("stThemeSwitcher-Dark")
    expect(darkButton).toHaveAttribute("aria-pressed", "false")
  })

  it("shows Light as active when light theme is selected", () => {
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: lightTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    const systemButton = screen.getByTestId("stThemeSwitcher-System")
    expect(systemButton).toHaveAttribute("aria-pressed", "false")

    const lightButton = screen.getByTestId("stThemeSwitcher-Light")
    expect(lightButton).toHaveAttribute("aria-pressed", "true")
  })

  it("shows Dark as active when dark theme is selected", () => {
    renderWithContexts(<ThemeSwitcher {...getProps()} />, {
      themeContext: {
        activeTheme: darkTheme,
        availableThemes: [lightTheme, darkTheme, autoTheme],
        setTheme: mockSetTheme,
      },
    })

    const darkButton = screen.getByTestId("stThemeSwitcher-Dark")
    expect(darkButton).toHaveAttribute("aria-pressed", "true")
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
    expect(mockMetricsMgr.enqueue).toHaveBeenCalledWith("menuClick", {
      label: "changeTheme",
    })
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
    expect(mockMetricsMgr.enqueue).toHaveBeenCalledWith("menuClick", {
      label: "changeTheme",
    })
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
    expect(mockMetricsMgr.enqueue).toHaveBeenCalledWith("menuClick", {
      label: "changeTheme",
    })
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
      expect(mockMetricsMgr.enqueue).toHaveBeenCalledWith("menuClick", {
        label: "changeTheme",
      })
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

    it("shows System as active when custom auto theme is selected", () => {
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

      const systemButton = screen.getByTestId("stThemeSwitcher-System")
      expect(systemButton).toHaveAttribute("aria-pressed", "true")
    })

    it("shows Light as active when custom light theme is selected", () => {
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

      const lightButton = screen.getByTestId("stThemeSwitcher-Light")
      expect(lightButton).toHaveAttribute("aria-pressed", "true")
    })

    it("shows Dark as active when custom dark theme is selected", () => {
      renderWithContexts(<ThemeSwitcher {...getProps()} />, {
        themeContext: {
          activeTheme: customDarkTheme,
          availableThemes: [
            customLightTheme,
            customDarkTheme,
            customAutoTheme,
          ],
          setTheme: mockSetTheme,
        },
      })

      const darkButton = screen.getByTestId("stThemeSwitcher-Dark")
      expect(darkButton).toHaveAttribute("aria-pressed", "true")
    })
  })

  describe("metrics tracking", () => {
    it("enqueues menuClick metric when theme is changed", async () => {
      const user = userEvent.setup()
      renderWithContexts(<ThemeSwitcher {...getProps()} />, {
        themeContext: {
          activeTheme: autoTheme,
          availableThemes: [lightTheme, darkTheme, autoTheme],
          setTheme: mockSetTheme,
        },
      })

      await user.click(screen.getByTestId("stThemeSwitcher-Light"))

      expect(mockMetricsMgr.enqueue).toHaveBeenCalledTimes(1)
      expect(mockMetricsMgr.enqueue).toHaveBeenCalledWith("menuClick", {
        label: "changeTheme",
      })
    })

    it("does not enqueue metric if theme not found", async () => {
      const user = userEvent.setup()
      // Only provide light and dark themes, no auto theme
      renderWithContexts(<ThemeSwitcher {...getProps()} />, {
        themeContext: {
          activeTheme: lightTheme,
          availableThemes: [lightTheme, darkTheme],
          setTheme: mockSetTheme,
        },
      })

      await user.click(screen.getByTestId("stThemeSwitcher-System"))

      // setTheme should not be called if theme not found
      expect(mockSetTheme).not.toHaveBeenCalled()
      expect(mockMetricsMgr.enqueue).not.toHaveBeenCalled()
    })
  })
})
