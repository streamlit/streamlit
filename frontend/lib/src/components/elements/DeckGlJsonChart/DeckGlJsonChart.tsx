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

import React, { PureComponent, ReactNode } from "react"

import { DeckGL } from "@deck.gl/react/typed"
import JSON5 from "json5"
import isEqual from "lodash/isEqual"
import { MapContext, NavigationControl, StaticMap } from "react-map-gl"
import { withTheme } from "@emotion/react"
import {
  CartoLayer,
  colorBins,
  colorCategories,
  colorContinuous,
} from "@deck.gl/carto/typed"
import * as layers from "@deck.gl/layers/typed"
import { JSONConverter } from "@deck.gl/json/typed"
import * as geoLayers from "@deck.gl/geo-layers/typed"
import * as aggregationLayers from "@deck.gl/aggregation-layers/typed"
import * as meshLayers from "@deck.gl/mesh-layers/typed"
import { DeckProps, PickingInfo } from "@deck.gl/core/typed"
import { TooltipContent } from "@deck.gl/core/typed/lib/tooltip"
import { CSVLoader } from "@loaders.gl/csv"
import { GLTFLoader } from "@loaders.gl/gltf"
import { registerLoaders } from "@loaders.gl/core"

import {
  EmotionTheme,
  hasLightBackgroundColor,
} from "@streamlit/lib/src/theme"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"

import withMapboxToken from "./withMapboxToken"
import {
  StyledDeckGlChart,
  StyledNavigationControlContainer,
} from "./styled-components"

import "mapbox-gl/dist/mapbox-gl.css"

interface DeckObject {
  initialViewState: {
    height: number
    width: number
  }
  layers: DeckProps["layers"]
  mapStyle?: string | Array<string>
}

const configuration = {
  classes: {
    ...layers,
    ...aggregationLayers,
    ...geoLayers,
    ...meshLayers,
    CartoLayer,
  },
  functions: {
    colorBins,
    colorCategories,
    colorContinuous,
  },
}

registerLoaders([CSVLoader, GLTFLoader])

const jsonConverter = new JSONConverter({ configuration })

export interface DeckGLProps {
  width: number
  theme: EmotionTheme
  mapboxToken: string
  element: DeckGlJsonChartProto
  isFullScreen?: boolean
}

export interface PropsWithHeight extends DeckGLProps {
  height?: number
}

export interface State {
  viewState: Record<string, unknown>
  initialized: boolean
  initialViewState: Record<string, unknown>
  id: string | undefined
  pydeckJson: any
  isFullScreen: boolean
  isLightTheme: boolean
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
    id: undefined,
    pydeckJson: undefined,
    isFullScreen: false,
    isLightTheme: hasLightBackgroundColor(this.props.theme),
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
    const deck = DeckGlJsonChart.getDeckObject(props, state)

    // If the ViewState on the server has changed, apply the diff to the current state
    if (!isEqual(deck.initialViewState, state.initialViewState)) {
      const diff = Object.keys(deck.initialViewState).reduce(
        (diff, key): any => {
          // @ts-expect-error
          if (deck.initialViewState[key] === state.initialViewState[key]) {
            return diff
          }

          return {
            ...diff,
            // @ts-expect-error
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

  static getDeckObject = (
    props: PropsWithHeight,
    state: Partial<State>
  ): DeckObject => {
    const { element, width, height, theme, isFullScreen } = props

    const currFullScreen = isFullScreen ?? false

    // Only parse JSON when not transitioning to/from fullscreen, the element id changes, or theme changes
    if (
      element.id !== state.id ||
      state.isFullScreen !== currFullScreen ||
      state.isLightTheme !== hasLightBackgroundColor(theme)
    ) {
      state.pydeckJson = JSON5.parse(element.json)
      state.id = element.id
    }

    // If unset, use either the Mapbox light or dark style based on Streamlit's theme
    // For Mapbox styles, see https://docs.mapbox.com/api/maps/styles/#mapbox-styles
    if (!state.pydeckJson?.mapStyle) {
      state.pydeckJson.mapStyle = `mapbox://styles/mapbox/${
        hasLightBackgroundColor(theme) ? "light" : "dark"
      }-v9`
    }

    // Set width and height based on the fullscreen state
    if (isFullScreen) {
      Object.assign(state.pydeckJson?.initialViewState, { width, height })
    } else {
      if (!state.pydeckJson?.initialViewState?.height) {
        state.pydeckJson.initialViewState.height = DEFAULT_DECK_GL_HEIGHT
      }
      if (element.useContainerWidth) {
        state.pydeckJson.initialViewState.width = width
      }
    }

    state.isFullScreen = isFullScreen
    state.isLightTheme = hasLightBackgroundColor(theme)

    delete state.pydeckJson?.views // We are not using views. This avoids a console warning.

    return jsonConverter.convert(state.pydeckJson)
  }

  createTooltip = (info: PickingInfo): TooltipContent => {
    const { element } = this.props

    if (!info || !info.object || !element.tooltip) {
      return null
    }

    const tooltip = JSON5.parse(element.tooltip)

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
        } else if (
          info.object.hasOwnProperty("properties") &&
          info.object.properties.hasOwnProperty(variable)
        ) {
          body = body.replace(match, info.object.properties[variable])
        }
      })
    }
    return body
  }

  onViewStateChange: DeckProps["onViewStateChange"] = ({ viewState }) => {
    this.setState({ viewState })
  }

  render(): ReactNode {
    const deck = DeckGlJsonChart.getDeckObject(this.props, this.state)
    const { viewState } = this.state
    const { width } = this.props

    return (
      <StyledDeckGlChart
        className="stDeckGlJsonChart"
        data-testid="stDeckGlJsonChart"
        width={width}
        height={deck.initialViewState.height}
      >
        <DeckGL
          viewState={viewState}
          onViewStateChange={this.onViewStateChange}
          height={deck.initialViewState.height}
          width={width}
          layers={this.state.initialized ? deck.layers : []}
          getTooltip={this.createTooltip}
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
            mapboxApiAccessToken={
              this.props.element.mapboxToken || this.props.mapboxToken
            }
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
}

export default withTheme(
  withMapboxToken("st.pydeck_chart")(withFullScreenWrapper(DeckGlJsonChart))
)
