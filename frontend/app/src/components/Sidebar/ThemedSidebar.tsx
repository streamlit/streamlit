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

import React, { ReactElement, useContext } from "react"

import { getLuminance } from "color2k"

import {
  createTheme,
  LibContext,
  ThemeConfig,
  ThemeProvider,
} from "@streamlit/lib"
import { CustomThemeConfig } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import Sidebar, { SidebarProps } from "./Sidebar"

const setSidebarHeadingFontSizes = (
  configHeadingFontSizes: string[] | null | undefined
): string[] => {
  // Default sidebar heading font sizes
  const sidebarHeadingFontSizes = [
    "1.5rem",
    "1.25rem",
    "1.125rem",
    "1rem",
    "0.875rem",
    "0.75rem",
  ]

  if (configHeadingFontSizes) {
    // If specifically set in sidebar config, override default
    configHeadingFontSizes.forEach((size: string, index: number) => {
      sidebarHeadingFontSizes[index] = size
    })
  }

  return sidebarHeadingFontSizes
}

export const createSidebarTheme = (theme: ThemeConfig): ThemeConfig => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sidebarOverride: Record<string, any> = {}
  if (notNullOrUndefined(theme.themeInput?.sidebar)) {
    // Create a mutable copy
    sidebarOverride = { ...theme.themeInput.sidebar }

    // Remove empty array fields to prevent them from being applied
    // on top of the main theme.
    // This is needed since the optional protobuf keyword is not allowed
    // for repeated fields. Therefore, we are treating empty
    // arrays as non-existent.
    Object.keys(sidebarOverride).forEach(prop => {
      const value = sidebarOverride[prop]
      if (Array.isArray(value) && value.length === 0) {
        delete sidebarOverride[prop]
      }
    })
  }

  // Handle configured vs. default header font sizes for sidebar
  const headingFontSizes = setSidebarHeadingFontSizes(
    theme.themeInput?.sidebar?.headingFontSizes
  )

  // Either use the configured background color or secondary background from main theme:
  const sidebarBackground =
    theme.themeInput?.sidebar?.backgroundColor ||
    theme.emotion.colors.secondaryBg

  // Either use the configured secondary background color or background from main theme:
  const secondaryBackgroundColor =
    theme.themeInput?.sidebar?.secondaryBackgroundColor ||
    theme.emotion.colors.bgColor

  // Override the background and secondary background colors in sidebar overwrites:
  sidebarOverride = {
    ...sidebarOverride,
    backgroundColor: sidebarBackground,
    secondaryBackgroundColor: secondaryBackgroundColor,
    headingFontSizes: headingFontSizes,
  }

  const baseTheme =
    getLuminance(sidebarBackground) > 0.5
      ? CustomThemeConfig.BaseTheme.LIGHT
      : CustomThemeConfig.BaseTheme.DARK

  return createTheme(
    "Sidebar",
    {
      ...theme.themeInput, // Use the theme props from the main theme as basis
      base: baseTheme,
      ...sidebarOverride,
    },
    undefined, // Creating a new theme from scratch
    true // inSidebar
  )
}

const ThemedSidebar = ({
  children,
  ...sidebarProps
}: Omit<SidebarProps, "chevronDownshift">): ReactElement => {
  const { activeTheme } = useContext(LibContext)
  const sidebarTheme = createSidebarTheme(activeTheme)

  return (
    <ThemeProvider
      theme={sidebarTheme.emotion}
      baseuiTheme={sidebarTheme.basewebTheme}
    >
      <Sidebar {...sidebarProps}>{children}</Sidebar>
    </ThemeProvider>
  )
}

export default ThemedSidebar
