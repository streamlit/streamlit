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

import { ReactElement, ReactNode, useContext, useMemo } from "react"

import { IThemeOverride } from "@streamlit/protobuf"

import { ThemeContext } from "~lib/components/core/ThemeContext"
import ThemeProvider from "~lib/components/core/ThemeProvider"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { createThemeFromOverride } from "~lib/theme/createThemeFromOverride"

export interface ScopedThemeProviderProps {
  override: IThemeOverride
  children: ReactNode
}

/**
 * Nested Emotion theme provider for an st.container(theme=) override.
 * Uses the nearest Emotion theme as the inherit parent, including sidebar.
 */
export default function ScopedThemeProvider({
  override,
  children,
}: ScopedThemeProviderProps): ReactElement {
  const parentEmotion = useEmotionTheme()
  const { availableThemes } = useContext(ThemeContext)

  const scopedTheme = useMemo(
    () => createThemeFromOverride(override, parentEmotion, availableThemes),
    [override, parentEmotion, availableThemes]
  )

  return <ThemeProvider theme={scopedTheme.emotion}>{children}</ThemeProvider>
}
