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

import React, { PureComponent, ReactNode } from "react"
import DeckGL from "deck.gl"
import Immutable from "immutable"
import isEqual from "lodash/isEqual"
import { StaticMap } from "react-map-gl"
import * as layers from "@deck.gl/layers"
import { JSONConverter } from "@deck.gl/json"
import * as geoLayers from "@deck.gl/geo-layers"
import * as aggregationLayers from "@deck.gl/aggregation-layers"

import { CSVLoader } from "@loaders.gl/csv"
import { registerLoaders } from "@loaders.gl/core"

import withFullScreenWrapper from "hocs/withFullScreenWrapper"
import withMapboxToken from "hocs/withMapboxToken"

import "mapbox-gl/dist/mapbox-gl.css"
import "./DeckGlJsonChart.scss"

interface PickingInfo {
  object: {
    [key: string]: string
  }
}

interface DeckObject {
  initialViewState: {
    height: number
    width: number
  }
  layers: Array<object>
  mapStyle?: string | Array<string>
}

const configuration = {
  classes: { ...layers, ...aggregationLayers, ...geoLayers },
}

registerLoaders([CSVLoader])

const jsonConverter = new JSONConverter({ configuration })

interface Props {
  width: number
  mapboxToken: string
  element: Immutable.Map<string, any>
}

export interface PropsWithHeight extends Props {
  height: number | undefined
}

interface State {
  viewState: object
  initialized: boolean
  initialViewState: object
}

export const DEFAULT_DECK_GL_HEIGHT = 500

export class DeckGlJsonChart extends PureComponent<PropsWithHeight, State> {
  readonly state = {
    viewState: {
      bearing: 0,
      pitch: 0,
      zoom: 11,
    },
    initialized: false,
    initialViewState: {},
  }

  componentDidMount = (): void => {
    // HACK: Load layers a little after loading the map, to hack around a bug
    // where HexagonLayers were not drawing on first load but did load when the
    // script got re-executed.
    this.setState({
      initialized: true,
    })
  }

  static getDerivedStateFromProps(
    props: Readonly<PropsWithHeight>,
    state: Partial<State>
  ): Partial<State> | null {
    const deck = DeckGlJsonChart.getDeckObject(props)

    // If the ViewState on the server has changed, apply the diff to the current state
    if (!isEqual(deck.initialViewState, state.initialViewState)) {
      const diff = Object.keys(deck.initialViewState).reduce(
        (diff, key): any => {
          // @ts-ignore
          if (deck.initialViewState[key] === state.initialViewState[key]) {
            return diff
          }

          return {
            ...diff,
            // @ts-ignore
            [key]: deck.initialViewState[key],
          }
        },
        {}
      )

      return {
        viewState: { ...state.viewState, ...diff },
        initialViewState: deck.initialViewState,
      }
    }

    return null
  }

  static getDeckObject = (props: PropsWithHeight): DeckObject => {
    const { element, width, height } = props
    const useContainerWidth = element.get("useContainerWidth")
    const json = JSON.parse(element.get("json"))

    // The graph dimensions could be set from props ( like withFullscreen ) or
    // from the generated element object
    if (height) {
      json.initialViewState.height = height
      json.initialViewState.width = width
    } else {
      if (!json.initialViewState.height) {
        json.initialViewState.height = DEFAULT_DECK_GL_HEIGHT
      }

      if (useContainerWidth) {
        json.initialViewState.width = width
      }
    }

    delete json.views // We are not using views. This avoids a console warning.

    return jsonConverter.convert(json)
  }

  createTooltip = (info: PickingInfo): object | boolean => {
    const { element } = this.props
    let tooltip = element.get("tooltip")

    if (!info || !info.object || !tooltip) {
      return false
    }

    tooltip = JSON.parse(tooltip)

    // NB: https://deckgl.readthedocs.io/en/latest/tooltip.html
    if (tooltip.html) {
      tooltip.html = this.interpolate(info, tooltip.html)
    } else {
      tooltip.text = this.interpolate(info, tooltip.text)
    }

    return tooltip
  }

  interpolate = (info: PickingInfo, body: string): string => {
    const matchedVariables = body.match(/{(.*?)}/g)
    if (matchedVariables) {
      matchedVariables.forEach((match: string) => {
        const variable = match.substring(1, match.length - 1)

        if (info.object.hasOwnProperty(variable)) {
          body = body.replace(match, info.object[variable])
        }
      })
    }
    return body
  }

  onViewStateChange = ({ viewState }: State): void => {
    this.setState({ viewState })
  }

  render(): ReactNode {
    const deck = DeckGlJsonChart.getDeckObject(this.props)
    const { viewState } = this.state

    return (
      <div
        className="stDeckGlJsonChart"
        style={{
          height: deck.initialViewState.height,
          width: deck.initialViewState.width,
        }}
      >
        <DeckGL
          viewState={viewState}
          onViewStateChange={this.onViewStateChange}
          height={deck.initialViewState.height}
          width={deck.initialViewState.width}
          layers={this.state.initialized ? deck.layers : []}
          getTooltip={this.createTooltip}
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
            mapboxApiAccessToken={this.props.mapboxToken}
          />
        </DeckGL>
      </div>
    )
  }
}

export default withMapboxToken("st.pydeck_chart")(
  withFullScreenWrapper(DeckGlJsonChart)
)
