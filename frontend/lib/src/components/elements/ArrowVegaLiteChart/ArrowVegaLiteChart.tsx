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

import React, { FC, memo, useEffect, useLayoutEffect } from "react"

import { Global } from "@emotion/react"

import { WidgetStateManager } from "~lib/WidgetStateManager"
import Toolbar, {
  StyledToolbarElementContainer,
} from "~lib/components/shared/Toolbar"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { withFullScreenWrapper } from "~lib/components/shared/FullScreenWrapper"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"

import { VegaLiteChartElement } from "./arrowUtils"
import {
  StyledVegaLiteChartContainer,
  StyledVegaLiteChartTooltips,
} from "./styled-components"
import { useVegaElementPreprocessor } from "./useVegaElementPreprocessor"
import { useVegaEmbed } from "./useVegaEmbed"

export interface Props {
  element: VegaLiteChartElement
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disableFullscreenMode?: boolean
}

const ArrowVegaLiteChart: FC<Props> = ({
  disableFullscreenMode,
  element: inputElement,
  fragmentId,
  widgetMgr,
}) => {
  const {
    expanded: isFullScreen,
    height,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)
  const [width, containerRef] = useCalculatedWidth()

  // We preprocess the input vega element to do a two things:
  // 1. Update the spec to handle Streamlit specific configurations such as
  //    theming, container width, and full screen mode
  // 2. Stabilize some aspects of the input element to detect changes in the
  //    configuration of the chart since each element will always provide new references
  //    Note: We do not stabilize data/datasets as that is managed by the embed.
  const element = useVegaElementPreprocessor(
    inputElement,
    isFullScreen,
    width,
    height ?? 0
  )

  // This hook provides lifecycle functions for creating and removing the view.
  // It also will update the view if the data changes (and not the spec)
  const { createView, updateView, finalizeView } = useVegaEmbed(
    element,
    widgetMgr,
    fragmentId
  )

  const { data, datasets, spec } = element

  // Create the view once the container is ready and re-create
  // if the spec changes or the dimensions change.
  // We utilize useLayoutEffect to ensure that the view is created
  // after the container is mounted to avoid layout shift.
  useLayoutEffect(() => {
    if (containerRef.current !== null) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      createView(containerRef, spec)
    }

    return finalizeView
  }, [createView, finalizeView, spec, width, height, containerRef])

  // The references to data and datasets will always change each rerun
  // because the forward message always produces new references, so
  // this function will run regularly to update the view.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
    updateView(data, datasets)
  }, [data, datasets, updateView])

  // Create the container inside which Vega draws its content.
  // To style the Vega tooltip, we need to apply global styles since
  // the tooltip element is drawn outside of this component.
  return (
    <StyledToolbarElementContainer
      width={width}
      height={height}
      useContainerWidth={element.useContainerWidth}
    >
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
      ></Toolbar>
      <Global styles={StyledVegaLiteChartTooltips} />
      <StyledVegaLiteChartContainer
        data-testid="stVegaLiteChart"
        className="stVegaLiteChart"
        useContainerWidth={element.useContainerWidth}
        isFullScreen={isFullScreen}
        ref={containerRef}
      />
    </StyledToolbarElementContainer>
  )
}

const ArrowVegaLiteChartWithFullScreen =
  withFullScreenWrapper(ArrowVegaLiteChart)
export default memo(ArrowVegaLiteChartWithFullScreen)
