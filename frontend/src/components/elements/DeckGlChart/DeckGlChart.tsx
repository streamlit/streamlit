/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, useEffect, useState } from "react"
import Immutable from "immutable"
import { StaticMap } from "react-map-gl"
import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import withMapboxToken from "hocs/withMapboxToken/withMapboxToken"
import "mapbox-gl/dist/mapbox-gl.css"
import "./DeckGlChart.scss"
import { buildLayer, getStyleUrl } from "./DeckGlChartUtil"
import DeckGL from "deck.gl"

export interface DeckGlChartProps {
  width: number
  mapboxToken: string
  element: Immutable.Map<string, any>
  height: number | undefined
}

interface ViewState {
  width: number
  height: number
  longitude: number
  latitude: number
  pitch: number
  bearing: number
  zoom: number
}

interface ViewPort extends ViewState {
  mapStyle: string
}

export function DeckGlChart({
  element,
  height = 500,
  mapboxToken,
  width,
}: DeckGlChartProps): ReactElement {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // HACK: Load layers a little after loading the map, to hack around a bug
    // where HexagonLayers were not drawing on first load but did load when the
    // script got re-executed.
    setInitialized(true)
  }, [])

  const getViewport = (): ViewPort => {
    const specStr = element.get("spec")
    const spec = specStr ? JSON.parse(specStr) : {}

    return spec.viewport || {}
  }

  const generateViewState = (viewPort: ViewPort): ViewState => {
    const useContainerWidth = element.get("useContainerWidth")

    return {
      width: !viewPort.width || useContainerWidth ? width : viewPort.width,
      height: viewPort.height || height,
      longitude: viewPort.longitude || 0,
      latitude: viewPort.latitude || 0,
      pitch: viewPort.pitch || 0,
      bearing: viewPort.bearing || 0,
      zoom: viewPort.zoom || 1,
    } as ViewState
  }

  const viewPort = getViewport()

  const initialViewState = generateViewState(viewPort)
  const mapStyle = getStyleUrl(viewPort.mapStyle)
  const buildLayers = (): any[] => {
    const layers = element.get("layers")
    return layers.map((layer: any) => buildLayer(layer)).toArray()
  }
  return (
    <div
      className="deckglchart stDeckGlChart"
      style={{
        height: initialViewState.height,
        width: initialViewState.width,
      }}
    >
      <DeckGL
        initialViewState={initialViewState}
        height={initialViewState.height}
        width={initialViewState.width}
        controller
        layers={initialized ? buildLayers() : []}
      >
        <StaticMap
          height={initialViewState.height}
          width={initialViewState.width}
          mapStyle={mapStyle}
          mapboxApiAccessToken={mapboxToken}
        />
      </DeckGL>
    </div>
  )
}

export default withMapboxToken("st.deck_gl_chart")(
  withFullScreenWrapper(DeckGlChart)
)
