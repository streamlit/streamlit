/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import PageLayoutContext from "src/components/core/PageLayoutContext"
import ThemeProvider from "src/components/core/ThemeProvider"
import { createTheme, ThemeConfig } from "src/theme"
import Sidebar, { SidebarProps } from "./Sidebar"

const createSidebarTheme = (theme: ThemeConfig): ThemeConfig =>
  createTheme(
    "Sidebar",
    {
      secondaryBackgroundColor: theme.emotion.colors.bgColor,
      backgroundColor: theme.emotion.colors.secondaryBg,
    },
    {
      ...theme,
      emotion: {
        ...theme.emotion,
        inSidebar: true,
      },
    }
  )

const ThemedSidebar = ({
  theme,
  children,
  ...sidebarProps
}: Partial<SidebarProps>): ReactElement => {
  const { activeTheme } = React.useContext(PageLayoutContext)
  const baseSidebarTheme = createSidebarTheme(activeTheme)
  // Add a flag for inSidebar. Currently used for file uploader compact styling.
  // Ideally we can switch over to variables in the future instead of using a flag.
  const sidebarTheme = {
    ...baseSidebarTheme,
    emotion: {
      ...baseSidebarTheme.emotion,
      inSidebar: true,
    },
  }

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
