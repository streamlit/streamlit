/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { PureComponent, ReactNode } from "react"
import { DeckGL } from "deck.gl"
import isEqual from "lodash/isEqual"
import { MapContext, StaticMap, NavigationControl } from "react-map-gl"
import { withTheme } from "@emotion/react"
import { hasLightBackgroundColor, Theme } from "src/theme"
// We don't have Typescript defs for these imports, which makes ESLint unhappy
/* eslint-disable import/no-extraneous-dependencies */
import * as layers from "@deck.gl/layers"
import { JSONConverter } from "@deck.gl/json"
import * as geoLayers from "@deck.gl/geo-layers"
import * as aggregationLayers from "@deck.gl/aggregation-layers"
import * as meshLayers from "@deck.gl/mesh-layers"
/* eslint-enable */

import { CSVLoader } from "@loaders.gl/csv"
import { GLTFLoader } from "@loaders.gl/gltf"
import { registerLoaders } from "@loaders.gl/core"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import withMapboxToken from "src/hocs/withMapboxToken"

import { notNullOrUndefined } from "src/lib/utils"

import { DeckGlJsonChart as DeckGlJsonChartProto } from "src/autogen/proto"
import {
  StyledDeckGlChart,
  StyledNavigationControlContainer,
} from "./styled-components"

import "mapbox-gl/dist/mapbox-gl.css"

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
  layers: Record<string, unknown>[]
  mapStyle?: string | Array<string>
}

const configuration = {
  classes: { ...layers, ...aggregationLayers, ...geoLayers, ...meshLayers },
}

registerLoaders([CSVLoader, GLTFLoader])

const jsonConverter = new JSONConverter({ configuration })

interface Props {
  width: number
  theme: Theme
  mapboxToken: string
  element: DeckGlJsonChartProto
}

export interface PropsWithHeight extends Props {
  height: number | undefined
}

interface State {
  viewState: Record<string, unknown>
  initialized: boolean
  initialViewState: Record<string, unknown>
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
    const { element, width, height, theme } = props
    const json = JSON.parse(element.json)

    // If unset, use either the Mapbox light or dark style based on Streamlit's theme
    // For Mapbox styles, see https://docs.mapbox.com/api/maps/styles/#mapbox-styles
    if (!notNullOrUndefined(json.mapStyle)) {
      const mapTheme = hasLightBackgroundColor(theme) ? "light" : "dark"
      json.mapStyle = `mapbox://styles/mapbox/${mapTheme}-v9`
    }

    // The graph dimensions could be set from props ( like withFullscreen ) or
    // from the generated element object
    if (height) {
      json.initialViewState.height = height
      json.initialViewState.width = width
    } else {
      if (!json.initialViewState.height) {
        json.initialViewState.height = DEFAULT_DECK_GL_HEIGHT
      }

      if (element.useContainerWidth) {
        json.initialViewState.width = width
      }
    }

    delete json.views // We are not using views. This avoids a console warning.

    return jsonConverter.convert(json)
  }

  createTooltip = (info: PickingInfo): Record<string, unknown> | boolean => {
    const { element } = this.props

    if (!info || !info.object || !element.tooltip) {
      return false
    }

    const tooltip = JSON.parse(element.tooltip)

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
      <StyledDeckGlChart
        className="stDeckGlJsonChart"
        width={deck.initialViewState.width}
        height={deck.initialViewState.height}
      >
        <DeckGL
          viewState={viewState}
          onViewStateChange={this.onViewStateChange}
          height={deck.initialViewState.height}
          width={deck.initialViewState.width}
          layers={this.state.initialized ? deck.layers : []}
          getTooltip={this.createTooltip}
          ContextProvider={MapContext.Provider}
          controller
        >
          <StaticMap
            height={deck.initialViewState.height}
            width={deck.initialViewState.width}
            mapStyle={
              deck.mapStyle &&
              (typeof deck.mapStyle === "string"
                ? deck.mapStyle
                : deck.mapStyle[0])
            }
            mapboxApiAccessToken={this.props.mapboxToken}
          />
          <StyledNavigationControlContainer>
            <NavigationControl className="zoomButton" showCompass={false} />
          </StyledNavigationControlContainer>
        </DeckGL>
      </StyledDeckGlChart>
    )
  }
}

export default withTheme(
  withMapboxToken("st.pydeck_chart")(withFullScreenWrapper(DeckGlJsonChart))
)
