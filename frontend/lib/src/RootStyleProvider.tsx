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

import { forwardRef, ReactElement, useMemo } from "react"
import type { CSSProperties, HTMLAttributes } from "react"

import createCache from "@emotion/cache"
import {
  CacheProvider,
  ThemeProvider as EmotionThemeProvider,
  Global,
} from "@emotion/react"
import { BaseProvider } from "baseui"
import { createPortal } from "react-dom"

import { globalStyles } from "./theme/globalStyles"
import type { ThemeConfig } from "./theme/types"

interface RootStyleProviderProps {
  theme: ThemeConfig
  children: React.ReactNode
}

type BasewebLayerHostProps = HTMLAttributes<HTMLDivElement>

const BasewebLayerHost = forwardRef<HTMLDivElement, BasewebLayerHostProps>(
  function BasewebLayerHost(props, ref): ReactElement {
    return createPortal(<div {...props} ref={ref} />, document.body)
  }
)

const getBasewebLayerHostStyle = (zIndex: number): CSSProperties => ({
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex,
  pointerEvents: "none",
})

const nonce = document.currentScript?.nonce || ""
const cache = createCache({
  // The key field is required but only matters if there's more than one
  // emotion cache in use. This will probably never be true for us, so we just
  // set it arbitrarily.
  key: "st-emotion-cache",
  ...(nonce && { nonce }),
})

export function RootStyleProvider(
  props: RootStyleProviderProps
): ReactElement {
  const { children, theme } = props
  const popupZIndex = theme.emotion.zIndices.popup

  const baseProviderOverrides = useMemo(
    () => ({
      // Cleanup: this body-level layer host can be removed once BaseWeb has
      // been fully removed from Streamlit's frontend.
      LayersContainer: {
        component: BasewebLayerHost,
        props: {
          "data-st-baseweb-layer-host": "true",
          "data-st-overlay-root": "true",
          "data-react-aria-top-layer": "true",
          style: getBasewebLayerHostStyle(popupZIndex),
        },
      },
    }),
    [popupZIndex]
  )

  return (
    <BaseProvider
      theme={theme.basewebTheme}
      // BaseWeb layers must use Streamlit's popup layer so legacy dropdowns,
      // popovers, and calendars render above React Aria dialogs.
      zIndex={popupZIndex}
      overrides={baseProviderOverrides}
    >
      <CacheProvider value={cache}>
        <EmotionThemeProvider theme={theme.emotion}>
          <Global styles={globalStyles} />
          {children}
        </EmotionThemeProvider>
      </CacheProvider>
    </BaseProvider>
  )
}
