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

import { memo, ReactElement, useEffect, useMemo } from "react"

import { Global } from "@emotion/react"
import { getLogger } from "loglevel"

import {
  Perspective as PerspectiveProto,
  streamlit,
} from "@streamlit/protobuf"

import {
  shouldHeightStretch,
  shouldWidthStretch,
} from "~lib/components/core/Layout/utils"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import { StyledToolbarElementContainer } from "~lib/components/shared/Toolbar/styled-components"
import Toolbar from "~lib/components/shared/Toolbar/Toolbar"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  createStreamlitPerspectiveTheme,
  resolvePerspectiveThemeName,
} from "./streamlitTheme"
import { StyledPerspectiveContainer } from "./styled-components"
import { usePerspective } from "./usePerspective"

const LOG = getLogger("Perspective")

/** Default height for Perspective viewer when no height is specified */
const DEFAULT_HEIGHT = 500

export interface PerspectiveProps {
  element: PerspectiveProto
  widgetMgr: WidgetStateManager
  disableFullscreenMode?: boolean
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}

function Perspective({
  element,
  widgetMgr,
  disableFullscreenMode,
  widthConfig,
  heightConfig,
}: Readonly<PerspectiveProps>): ReactElement {
  const theme = useEmotionTheme()
  const {
    expanded: isFullScreen,
    width,
    height: fullScreenHeight,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  // Get Arrow data from the element
  const arrowData = useMemo(() => {
    const data = element.data?.data
    if (!data) {
      return new Uint8Array(0)
    }
    return data instanceof Uint8Array ? data : new Uint8Array(data)
  }, [element.data])

  // Determine sizing
  const shouldUseContainerWidth = shouldWidthStretch(widthConfig)
  const shouldUseContainerHeight = shouldHeightStretch(heightConfig)
  const pixelHeight = heightConfig?.pixelHeight ?? DEFAULT_HEIGHT
  const perspectiveThemeName = resolvePerspectiveThemeName(
    element.theme || "streamlit"
  )

  // Initialize Perspective viewer
  const { viewerRef, isViewerReady, error } = usePerspective({
    elementId: element.id || "",
    arrowData,
    defaultConfigJson: element.defaultConfigJson || undefined,
    theme: element.theme || "streamlit",
    schemaDigest: element.schemaDigest || "",
    widgetMgr,
  })

  // Log any errors
  useEffect(() => {
    if (error) {
      LOG.error("Perspective initialization error:", error)
    }
  }, [error])

  return (
    <StyledToolbarElementContainer
      width={width ?? 0}
      height={!isFullScreen ? pixelHeight : (fullScreenHeight ?? pixelHeight)}
      useContainerWidth={isFullScreen || shouldUseContainerWidth}
      useContainerHeight={shouldUseContainerHeight}
    >
      <Global styles={createStreamlitPerspectiveTheme(theme)} />
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
      />
      <StyledPerspectiveContainer
        className="stPerspective"
        data-testid="stPerspective"
        height={
          !isFullScreen ? pixelHeight : (fullScreenHeight ?? pixelHeight)
        }
        useContainerWidth={isFullScreen || shouldUseContainerWidth}
        useContainerHeight={shouldUseContainerHeight}
      >
        {error ? (
          <div className="stPerspectiveError" data-testid="stPerspectiveError">
            Error loading Perspective: {error.message}
          </div>
        ) : isViewerReady ? (
          <perspective-viewer
            // @ts-expect-error - perspective-viewer is a custom element
            ref={viewerRef}
            theme={perspectiveThemeName}
          />
        ) : null}
      </StyledPerspectiveContainer>
    </StyledToolbarElementContainer>
  )
}

const PerspectiveWithFullScreen = withFullScreenWrapper(Perspective)
export default memo(PerspectiveWithFullScreen)
