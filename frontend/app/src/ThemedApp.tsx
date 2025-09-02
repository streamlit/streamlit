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

import React from "react"

import FontFaceDeclaration from "@streamlit/app/src/components/FontFaceDeclaration"
import FontSources from "@streamlit/app/src/components/FontSources"
import {
  PortalProvider,
  RootStyleProvider,
  WindowDimensionsProvider,
} from "@streamlit/lib"

import AppWithScreencast from "./App"
import { useThemeManager } from "./util/useThemeManager"

export interface ThemedAppProps {
  streamlitExecutionStartedAt: number
}

const ThemedApp = ({
  streamlitExecutionStartedAt,
}: ThemedAppProps): JSX.Element => {
  const [themeManager, fontFaces, fontSources] = useThemeManager()
  const { activeTheme } = themeManager

  return (
    <RootStyleProvider theme={activeTheme}>
      <WindowDimensionsProvider>
        {/* The data grid requires one root level portal element for rendering cell overlays */}
        <PortalProvider>
          {fontFaces.length > 0 && (
            <FontFaceDeclaration fontFaces={fontFaces} />
          )}
          {fontSources && <FontSources fontSources={fontSources} />}
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
