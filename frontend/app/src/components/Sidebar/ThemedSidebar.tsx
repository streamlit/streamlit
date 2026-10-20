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

import { type ReactElement, useContext, useMemo } from "react"

import {
  createSidebarTheme,
  ThemeContext,
  ThemeProvider,
} from "@streamlit/lib"

import Sidebar, { type SidebarProps } from "./Sidebar"

const ThemedSidebar = ({
  children,
  ...sidebarProps
}: Omit<SidebarProps, "chevronDownshift">): ReactElement => {
  const { activeTheme } = useContext(ThemeContext)
  // Keep the sidebar theme referentially stable across renders: descendants
  // use the theme as a hook dependency, and a new object on every render
  // re-runs their effects (e.g. tearing down st.audio_input's waveform).
  const sidebarTheme = useMemo(
    () => createSidebarTheme(activeTheme),
    [activeTheme]
  )

  return (
    <ThemeProvider theme={sidebarTheme.emotion}>
      <Sidebar {...sidebarProps}>{children}</Sidebar>
    </ThemeProvider>
  )
}

export default ThemedSidebar
