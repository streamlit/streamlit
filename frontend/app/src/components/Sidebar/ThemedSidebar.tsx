/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { ReactElement } from "react"

import {
  createTheme,
  CustomThemeConfig,
  LibContext,
  ThemeConfig,
  ThemeProvider,
} from "@streamlit/lib"
import { AppContext } from "@streamlit/app/src/components/AppContext"

import Sidebar, { SidebarProps } from "./Sidebar"

const createSidebarTheme = (theme: ThemeConfig): ThemeConfig => {
  return createTheme(
    "Sidebar",
    {
      ...theme.themeInput,
      base: CustomThemeConfig.BaseTheme.LIGHT,
      secondaryBackgroundColor:
        theme.emotion.colors.sidebarSecondaryBackgroundColor ??
        theme.emotion.colors.bgColor,
      backgroundColor:
        theme.emotion.colors.sidebarBackgroundColor ??
        theme.emotion.colors.secondaryBg,
      textColor:
        theme.emotion.colors.sidebarTextColor ?? theme.emotion.colors.bodyText,
      // Explictly pass these props to the sidebar theming as well.
      // This ensures custom fonts passed through postMessage propagate to the sidebar as well.
      bodyFont: theme.emotion.genericFonts.bodyFont,
      codeFont: theme.emotion.genericFonts.codeFont,
    },
    undefined,
    // inSidebar
    true
  )
}

const ThemedSidebar = ({
  children,
  ...sidebarProps
}: Omit<SidebarProps, "chevronDownshift" | "theme">): ReactElement => {
  const { sidebarChevronDownshift: chevronDownshift } =
    React.useContext(AppContext)
  const { activeTheme } = React.useContext(LibContext)
  const sidebarTheme = createSidebarTheme(activeTheme)

  return (
    <ThemeProvider
      theme={sidebarTheme.emotion}
      baseuiTheme={sidebarTheme.basewebTheme}
    >
      <Sidebar {...sidebarProps} chevronDownshift={chevronDownshift}>
        {children}
      </Sidebar>
    </ThemeProvider>
  )
}

export default ThemedSidebar
