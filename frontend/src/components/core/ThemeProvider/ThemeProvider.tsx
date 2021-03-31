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

import React, { ReactElement, ReactNode } from "react"
import { ThemeProvider as BaseUIThemeProvider } from "baseui"
import { ThemeProvider as EmotionThemeProvider } from "emotion-theming"

import { Theme, lightBaseUITheme, LightBaseUITheme } from "src/theme"

export interface ThemeProviderProps {
  theme: Theme
  baseuiTheme?: LightBaseUITheme
  children: ReactNode
}

function ThemeProvider({
  theme,
  baseuiTheme,
  children,
}: ThemeProviderProps): ReactElement {
  return (
    <BaseUIThemeProvider theme={baseuiTheme || lightBaseUITheme}>
      <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>
    </BaseUIThemeProvider>
  )
}

export default ThemeProvider
