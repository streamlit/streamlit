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

import React, { FC, useCallback, useEffect, useState } from "react"

import { DeckGL } from "@deck.gl/react/typed"
import { MapContext, NavigationControl, StaticMap } from "react-map-gl"
import { CSVLoader } from "@loaders.gl/csv"
import { GLTFLoader } from "@loaders.gl/gltf"
import { registerLoaders } from "@loaders.gl/core"
import { LayersList, PickingInfo } from "@deck.gl/core/typed"
import { useTheme } from "@emotion/react"

import {
  EmotionTheme,
  hasLightBackgroundColor,
} from "@streamlit/lib/src/theme"
import Toolbar from "@streamlit/lib/src/components/shared/Toolbar"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"
import { assertNever } from "@streamlit/lib/src/util/assertNever"

import withMapboxToken from "./withMapboxToken"
import {
  StyledDeckGlChart,
  StyledNavigationControlContainer,
} from "./styled-components"
import type { DeckGlElementState, DeckGLProps, LayerSelection } from "./types"
import { useDeckGl } from "./useDeckGl"

import "mapbox-gl/dist/mapbox-gl.css"

registerLoaders([CSVLoader, GLTFLoader])

const EMPTY_LAYERS: LayersList = []

export const DeckGlJsonChart: FC<DeckGLProps> = props => {
  const {
    collapse,
    disabled,
    disableFullscreenMode,
    element,
    expand,
    fragmentId,
    height: propsHeight,
    isFullScreen,
    mapboxToken: propsMapboxToken,
    widgetMgr,
    width: propsWidth,
  } = props
  const { selectionMode, mapboxToken: elementMapboxToken } = element
  const theme: EmotionTheme = useTheme()
  const {
    createTooltip,
    data: selection,
    deck,
    height,
    onViewStateChange,
    setSelection,
    viewState,
    width,
  } = useDeckGl({
    element,
    fragmentId,
    height: propsHeight,
    isFullScreen,
    isLightTheme: hasLightBackgroundColor(theme),
    theme,
    widgetMgr,
    width: propsWidth,
  })

  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // HACK: Load layers a little after loading the map, to hack around a bug
    // where HexagonLayers were not drawing on first load but did load when the
    // script got re-executed.
    setIsInitialized(true)
  }, [])

  const handleClick = useCallback(
    (
      info: PickingInfo,
      event: { srcEvent: MouseEvent | TouchEvent | PointerEvent }
    ) => {
      if (disabled) {
        return
      }

      const {
        color,
        index,
        picked,
        x,
        y,
        pixel,
        coordinate,
        devicePixel,
        pixelRatio,
        object,
      } = info

      const layerId = `${info.layer?.id || null}`
      const currState = selection

      const lastSelection: LayerSelection["last_selection"] = {
        color,
        layer: layerId,
        index,
        picked,
        x,
        y,
        pixel,
        coordinate,
        devicePixel,
        pixelRatio,
        object,
      }

      const getSelection = (): DeckGlElementState["selection"] => {
        switch (selectionMode) {
          case DeckGlJsonChartProto.SelectionMode.IGNORE:
            return {}
          case DeckGlJsonChartProto.SelectionMode.SINGLE: {
            const indices = index !== -1 ? [index] : []
            const objects = index !== -1 ? [object] : []

            return {
              [`${layerId}`]: {
                last_selection: lastSelection,
                indices,
                objects,
              },
            }
          }
          case DeckGlJsonChartProto.SelectionMode.MULTI: {
            const wasShiftClick = event.srcEvent.shiftKey

            const selectionMap: Map<number, unknown> = new Map(
              ((): [number, unknown][] => {
                if (!wasShiftClick) {
                  return []
                }

                const indices = currState?.selection?.[layerId]?.indices || []

                return indices.map((index, i) => [
                  index,
                  currState.selection?.[layerId].objects[i],
                ])
              })()
            )

            if (wasShiftClick && selectionMap.has(index)) {
              // Unselect an existing index
              selectionMap.delete(index)
            }

            if (index !== -1) {
              // Add the newly selected index
              selectionMap.set(index, object)
            }

            return {
              ...(wasShiftClick ? currState?.selection : {}),
              [`${layerId}`]: {
                last_selection: lastSelection,
                indices: Array.from(selectionMap.keys()),
                objects: Array.from(selectionMap.values()),
              },
            }
          }
          default:
            assertNever(selectionMode)
            throw new Error("Invalid selection mode")
        }
      }

      setSelection({
        fromUi: true,
        value: { selection: getSelection() },
      })
    },
    [disabled, selectionMode, selection, setSelection]
  )

  return (
    <StyledDeckGlChart
      className="stDeckGlJsonChart"
      data-testid="stDeckGlJsonChart"
      width={width}
      height={height}
    >
      <Toolbar
        isFullScreen={isFullScreen}
        disableFullscreenMode={disableFullscreenMode}
        onExpand={expand}
        onCollapse={collapse}
        target={StyledDeckGlChart}
      />
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        height={height}
        width={width}
        layers={isInitialized ? deck.layers : EMPTY_LAYERS}
        getTooltip={createTooltip}
        // @ts-expect-error There is a type mismatch due to our versions of the libraries
        ContextProvider={MapContext.Provider}
        controller
        onClick={typeof selectionMode === "number" ? handleClick : undefined}
      >
        <StaticMap
          height={height}
          width={width}
          mapStyle={
            deck.mapStyle &&
            (typeof deck.mapStyle === "string"
              ? deck.mapStyle
              : deck.mapStyle[0])
          }
          mapboxApiAccessToken={elementMapboxToken || propsMapboxToken}
        />
        <StyledNavigationControlContainer>
          <NavigationControl
            data-testid="stDeckGlJsonChartZoomButton"
            showCompass={false}
          />
        </StyledNavigationControlContainer>
      </DeckGL>
    </StyledDeckGlChart>
  )
}

export default withMapboxToken("st.pydeck_chart")(
  withFullScreenWrapper(DeckGlJsonChart, true)
)
