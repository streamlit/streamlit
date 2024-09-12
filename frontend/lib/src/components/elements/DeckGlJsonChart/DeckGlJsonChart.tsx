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

import React, { FC, useEffect, useState } from "react"

import { DeckGL } from "@deck.gl/react/typed"
import { MapContext, NavigationControl, StaticMap } from "react-map-gl"
import { CSVLoader } from "@loaders.gl/csv"
import { GLTFLoader } from "@loaders.gl/gltf"
import { registerLoaders } from "@loaders.gl/core"
import { LayersList } from "@deck.gl/core/typed"
import { useTheme } from "@emotion/react"

import {
  EmotionTheme,
  hasLightBackgroundColor,
} from "@streamlit/lib/src/theme"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"

import withMapboxToken from "./withMapboxToken"
import {
  StyledDeckGlChart,
  StyledNavigationControlContainer,
} from "./styled-components"
import type { PropsWithHeight } from "./types"
import { useDeckGl } from "./useDeckGl"

import "mapbox-gl/dist/mapbox-gl.css"

registerLoaders([CSVLoader, GLTFLoader])

const EMPTY_LAYERS: LayersList = []

export const DeckGlJsonChart: FC<PropsWithHeight> = props => {
  const { element, height, isFullScreen, width } = props
  const theme: EmotionTheme = useTheme()
  const { createTooltip, deck, onViewStateChange, viewState } = useDeckGl({
    element,
    isLightTheme: hasLightBackgroundColor(theme),
    width,
    height,
    isFullScreen,
  })

  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // HACK: Load layers a little after loading the map, to hack around a bug
    // where HexagonLayers were not drawing on first load but did load when the
    // script got re-executed.
    setIsInitialized(true)
  }, [])

  return (
    <StyledDeckGlChart
      className="stDeckGlJsonChart"
      data-testid="stDeckGlJsonChart"
      width={width}
      height={deck.initialViewState.height}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        height={deck.initialViewState.height}
        width={width}
        layers={isInitialized ? deck.layers : EMPTY_LAYERS}
        getTooltip={createTooltip}
        // @ts-expect-error There is a type mismatch due to our versions of the libraries
        ContextProvider={MapContext.Provider}
        controller
      >
        <StaticMap
          height={deck.initialViewState.height}
          width={width}
          mapStyle={
            deck.mapStyle &&
            (typeof deck.mapStyle === "string"
              ? deck.mapStyle
              : deck.mapStyle[0])
          }
          mapboxApiAccessToken={props.element.mapboxToken || props.mapboxToken}
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
  withFullScreenWrapper(DeckGlJsonChart)
)
