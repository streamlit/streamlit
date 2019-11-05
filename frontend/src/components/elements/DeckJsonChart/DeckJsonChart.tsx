/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import React from "react"
import DeckGL from "deck.gl"
import { JSONConverter } from "@deck.gl/json"
import * as layers from "@deck.gl/layers"
import * as aggregationLayers from "@deck.gl/aggregation-layers"
import Immutable from "immutable"
import { StaticMap } from "react-map-gl"
import FullScreenWrapper from "components/shared/FullScreenWrapper"
import "mapbox-gl/dist/mapbox-gl.css"
import "./DeckJsonChart.scss"

const configuration = {
  classes: Object.assign({}, layers, aggregationLayers),
}
const jsonConverter = new JSONConverter({ configuration })

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoidGhpYWdvdCIsImEiOiJjamh3bm85NnkwMng4M3dydnNveWwzeWNzIn0.vCBDzNsEF2uFSFk2AM0WZQ"

interface Props {
  width: number
  element: Immutable.Map<string, any>
}

interface PropsWithHeight extends Props {
  height: number | undefined
}

interface State {
  initialized: boolean
}

class DeckJsonChart extends React.PureComponent<PropsWithHeight, State> {
  static defaultProps = {
    height: 500,
  }

  private fixHexLayerBug_bound: () => void

  constructor(props: PropsWithHeight) {
    super(props)
    this.state = { initialized: false }
    this.fixHexLayerBug_bound = this.fixHexLayerBug.bind(this)

    // HACK: Load layers a little after loading the map, to hack around a bug
    // where HexagonLayers were not drawing on first load but did load when the
    // script got re-executed.
    setTimeout(this.fixHexLayerBug_bound, 0)
  }

  fixHexLayerBug(): void {
    this.setState({ initialized: true })
  }

  render(): JSX.Element {
    const { element, width, height } = this.props
    const json = JSON.parse(element.get("json"))
    json.initialViewState.height = height
    json.initialViewState.width = width
    delete json.views //We are nos using views, and this avoid a console warning
    const deck = jsonConverter.convert(json)

    return (
      <div
        className="deckglchart stDeckJsonChart"
        style={{
          height: deck.initialViewState.height,
          width: deck.initialViewState.width,
        }}
      >
        <DeckGL
          initialViewState={deck.initialViewState}
          height={deck.initialViewState.height}
          width={deck.initialViewState.width}
          layers={this.state.initialized ? deck.layers : []}
          controller
        >
          <StaticMap
            height={deck.initialViewState.height}
            width={deck.initialViewState.width}
            mapStyle={
              deck.mapStyle
                ? typeof deck.mapStyle === "string"
                  ? deck.mapStyle
                  : deck.mapStyle[0]
                : undefined
            }
            mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
          />
        </DeckGL>
      </div>
    )
  }
}

class WithFullScreenWrapper extends React.Component<Props> {
  render(): JSX.Element {
    const { element, width } = this.props
    return (
      <FullScreenWrapper width={width}>
        {({ width, height }) => (
          <DeckJsonChart element={element} width={width} height={height} />
        )}
      </FullScreenWrapper>
    )
  }
}

export default WithFullScreenWrapper
