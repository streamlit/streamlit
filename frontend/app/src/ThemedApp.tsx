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

import React, { useCallback, useEffect, useState } from "react"

import {
  isInChildFrame,
  PortalProvider,
  RootStyleProvider,
  ScrollbarSizeContext,
  WindowDimensionsProvider,
} from "@streamlit/lib"
import FontFaceDeclaration from "@streamlit/app/src/components/FontFaceDeclaration"

import AppWithScreencast from "./App"
import { useThemeManager } from "./util/useThemeManager"

export interface ThemedAppProps {
  streamlitExecutionStartedAt: number
}

/**
 * React hook to detect the scrollbar gutter size and set it as a CSS custom property (--scrollbar-gutter-size).
 */
const useScrollbarSize = (): number => {
  const [scrollbarGutterWidth, setScrollbarGutterWidth] = useState(0)

  const measureAndSetScrollbarWidth = useCallback(() => {
    // Create a temporary div to measure scrollbar gutter size
    const outer = document.createElement("div")
    outer.style.position = "absolute"
    outer.style.top = "-9999px" // Move it off-screen
    outer.style.left = "-9999px"
    outer.style.visibility = "hidden"
    outer.style.overflow = "scroll" // Triggers scrollbar
    outer.style.width = "50px" // Give it a fixed size to ensure overflow
    outer.style.height = "50px" // Give it a fixed size to ensure overflow
    document.body.appendChild(outer)

    // Create an inner div to measure content width
    const inner = document.createElement("div")
    inner.style.width = "100%" // Inner div takes full width of outer's content area
    outer.appendChild(inner)

    // Calculate the scrollbar gutter size
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
    const calculatedWidth = outer.offsetWidth - inner.offsetWidth

    // Remove the temporary divs
    outer.parentNode?.removeChild(outer)

    // Store the scrollbar gutter size in a CSS custom property(variable)
    document.documentElement.style.setProperty(
      "--scrollbar-gutter-size",
      `${calculatedWidth}px`
    )

    setScrollbarGutterWidth(calculatedWidth)
  }, [])

  useEffect(() => {
    let lastDevicePixelRatio = window.devicePixelRatio
    let animationFrameId: number | undefined
    let timeoutId: NodeJS.Timeout | undefined

    const handleResize = (): void => {
      if (window.devicePixelRatio !== lastDevicePixelRatio) {
        lastDevicePixelRatio = window.devicePixelRatio
        measureAndSetScrollbarWidth()
      }
    }

    const measureWithDelay = (): void => {
      // In iframe contexts, add an additional delay to ensure the rendering
      // context is fully established before measuring
      if (isInChildFrame()) {
        // Use a small timeout to allow the browser more time to establish
        // the iframe's layout and inherited styles
        timeoutId = setTimeout(() => {
          animationFrameId = requestAnimationFrame(measureAndSetScrollbarWidth)
        }, 1000)
      } else {
        animationFrameId = requestAnimationFrame(measureAndSetScrollbarWidth)
      }
    }

    // Ensure the document is fully loaded before measuring scrollbar size
    // This fixes issues in iframes where initial measurements return 0
    if (document.readyState !== "complete") {
      window.addEventListener("load", measureWithDelay, {
        once: true,
      })
    } else {
      // Document already loaded, measure with appropriate delay
      measureWithDelay()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId)
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      window.removeEventListener("load", measureWithDelay)
      window.removeEventListener("resize", handleResize)
    }
  }, [measureAndSetScrollbarWidth])

  return scrollbarGutterWidth
}

const ThemedApp = ({
  streamlitExecutionStartedAt,
}: ThemedAppProps): JSX.Element => {
  const [themeManager, fontFaces] = useThemeManager()
  const { activeTheme } = themeManager

  // Inject the --scrollbar-gutter-size variable into :root
  const scrollbarGutterSize = useScrollbarSize()

  return (
    <RootStyleProvider theme={activeTheme}>
      <WindowDimensionsProvider>
        <ScrollbarSizeContext.Provider value={scrollbarGutterSize}>
          {/* The data grid requires one root level portal element for rendering cell overlays */}
          <PortalProvider>
            {fontFaces.length > 0 && (
              <FontFaceDeclaration fontFaces={fontFaces} />
            )}
            <AppWithScreencast
              theme={themeManager}
              streamlitExecutionStartedAt={streamlitExecutionStartedAt}
            />
          </PortalProvider>
        </ScrollbarSizeContext.Provider>
      </WindowDimensionsProvider>
    </RootStyleProvider>
  )
}

export default ThemedApp
