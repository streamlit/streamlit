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

import React from "react"

import { CUSTOM_THEME_NAME, RootStyleProvider } from "@streamlit/lib"
import FontFaceDeclaration from "@streamlit/app/src/components/FontFaceDeclaration"
import { PortalProvider } from "@streamlit/lib/src/components/core/Portal/PortalProvider"
import { WindowDimensionsProvider } from "@streamlit/lib/src/components/shared/WindowDimensions/Provider"

import AppWithScreencast from "./App"
import { useThemeManager } from "./util/useThemeManager"

export interface ThemedAppProps {
  streamlitExecutionStartedAt: number
}

const ThemedApp = ({
  streamlitExecutionStartedAt,
}: ThemedAppProps): JSX.Element => {
  const [themeManager, fontFaces] = useThemeManager()
  const { activeTheme } = themeManager
  const hasCustomFonts =
    activeTheme.name === CUSTOM_THEME_NAME && fontFaces.length > 0

  return (
    <RootStyleProvider theme={activeTheme}>
      <WindowDimensionsProvider>
        {/* The data grid requires one root level portal element for rendering cell overlays */}
        <PortalProvider>
          {hasCustomFonts && <FontFaceDeclaration fontFaces={fontFaces} />}
          <AppWithScreencast
            theme={themeManager}
            streamlitExecutionStartedAt={streamlitExecutionStartedAt}
          />
        </PortalProvider>
      </WindowDimensionsProvider>
    </RootStyleProvider>
  )
}

export default ThemedApp
