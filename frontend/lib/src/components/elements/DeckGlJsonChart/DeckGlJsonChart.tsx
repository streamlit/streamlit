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

import { DeckGL } from "@deck.gl/react"
import { MapContext, NavigationControl, StaticMap } from "react-map-gl"
import { CSVLoader } from "@loaders.gl/csv"
import { GLTFLoader } from "@loaders.gl/gltf"
import { registerLoaders } from "@loaders.gl/core"
import { LayersList, PickingInfo } from "@deck.gl/core"
import { useTheme } from "@emotion/react"
import { Close } from "@emotion-icons/material-outlined"

import {
  EmotionTheme,
  hasLightBackgroundColor,
} from "@streamlit/lib/src/theme"
import Toolbar, {
  ToolbarAction,
} from "@streamlit/lib/src/components/shared/Toolbar"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"
import { assertNever } from "@streamlit/lib/src/util/assertNever"

import withMapboxToken from "./withMapboxToken"
import {
  StyledDeckGlChart,
  StyledNavigationControlContainer,
} from "./styled-components"
import type { DeckGlElementState, DeckGLProps } from "./types"
import { EMPTY_STATE, useDeckGl } from "./useDeckGl"

import "mapbox-gl/dist/mapbox-gl.css"

registerLoaders([CSVLoader, GLTFLoader])

const EMPTY_SELECTION = EMPTY_STATE.selection

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
  const { mapboxToken: elementMapboxToken } = element
  const theme: EmotionTheme = useTheme()
  const {
    createTooltip,
    data: selection,
    deck,
    hasActiveSelection,
    height,
    isSelectionModeActivated,
    onViewStateChange,
    selectionMode,
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
    (info: PickingInfo) => {
      if (selectionMode === undefined) {
        // Safety check
        return
      }

      const { index, object } = info

      const layerId = `${info.layer?.id || null}`
      const currState = selection
      /** true if a user clicked outside of any layer */
      const isResetClick = index === -1

      const getSelection = (): DeckGlElementState["selection"] => {
        if (isResetClick) {
          return EMPTY_SELECTION
        }

        switch (selectionMode) {
          case DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT: {
            if (currState.selection.indices[layerId]?.[0] === index) {
              // Unselect the index
              return EMPTY_SELECTION
            }

            return {
              indices: { [`${layerId}`]: [index] },
              objects: { [`${layerId}`]: [object] },
            }
          }
          case DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT: {
            const selectionMap: Map<number, unknown> = new Map(
              ((): [number, unknown][] => {
                const indices = currState?.selection?.indices?.[layerId] || []

                return indices.map((index, i) => [
                  index,
                  currState.selection?.objects?.[layerId]?.[i],
                ])
              })()
            )

            if (selectionMap.has(index)) {
              // Unselect an existing index
              selectionMap.delete(index)
            } else {
              // Add the newly selected index
              selectionMap.set(index, object)
            }

            if (selectionMap.size === 0) {
              // If the layer has nothing selected, remove the layer from the returned value
              // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
              const { [layerId]: _, ...restIndices } =
                currState.selection.indices
              // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
              const { [layerId]: __, ...restObjects } =
                currState.selection.objects

              return {
                indices: restIndices,
                objects: restObjects,
              }
            }

            return {
              indices: {
                ...currState.selection.indices,
                [`${layerId}`]: Array.from(selectionMap.keys()),
              },
              objects: {
                ...currState.selection.objects,
                [`${layerId}`]: Array.from(selectionMap.values()),
              },
            }
          }
          default:
            assertNever(selectionMode)
            throw new Error("Invalid selection mode")
        }
      }

      const newSelection = getSelection()

      if (
        JSON.stringify(newSelection) === JSON.stringify(currState.selection)
      ) {
        // If the new selection is the same as the current selection, do
        // nothing, and do not trigger a re-run
        return
      }

      setSelection({
        fromUi: true,
        value: { selection: newSelection },
      })
    },
    [selectionMode, selection, setSelection]
  )

  const handleClearSelectionClick = useCallback(() => {
    setSelection({
      value: { selection: EMPTY_SELECTION },
      fromUi: true,
    })
  }, [setSelection])

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
        locked={hasActiveSelection && !disabled ? true : undefined}
      >
        {hasActiveSelection && !disabled && (
          <ToolbarAction
            label="Clear selection"
            onClick={handleClearSelectionClick}
            icon={Close}
          />
        )}
      </Toolbar>
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
        onClick={
          isSelectionModeActivated && !disabled ? handleClick : undefined
        }
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
