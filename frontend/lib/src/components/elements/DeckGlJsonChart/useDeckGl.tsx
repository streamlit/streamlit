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

import { useCallback, useEffect, useMemo, useState } from "react"

import JSON5 from "json5"
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
import { PickingInfo } from "@deck.gl/core/typed"
import isEqual from "lodash/isEqual"
import { ViewStateChangeParameters } from "@deck.gl/core/typed/controllers/controller"
import { TooltipContent } from "@deck.gl/core/typed/lib/tooltip"

import { useStWidthHeight } from "@streamlit/lib/src/hooks/useStWidthHeight"

import type { DeckObject, PropsWithHeight, StreamlitDeckProps } from "./types"

export type UseDeckGlShape = {
  createTooltip: (info: PickingInfo | null) => TooltipContent
  deck: DeckObject
  height: number | string
  onViewStateChange: (params: ViewStateChangeParameters) => void
  viewState: Record<string, unknown>
  width: number | string
}

export type UseDeckGlProps = Omit<PropsWithHeight, "theme" | "mapboxToken"> & {
  isLightTheme: boolean
}

const DEFAULT_DECK_GL_HEIGHT = 500

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

export const jsonConverter = new JSONConverter({ configuration })

/**
 * Interpolates variables within a string using values from a PickingInfo object.
 *
 * This function searches for placeholders in the format `{variable}` within the provided
 * string `body` and replaces them with corresponding values from the `info` object.
 * It first checks if the variable exists directly on `info.object`, and if not, it checks
 * within `info.object.properties`.
 *
 * @param {PickingInfo} info - The object containing the data to interpolate into the string.
 * @param {string} body - The string containing placeholders in the format `{variable}`.
 * @returns {string} - The interpolated string with placeholders replaced by actual values.
 */
const interpolate = (info: PickingInfo, body: string): string => {
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

export const useDeckGl = (props: UseDeckGlProps): UseDeckGlShape => {
  const {
    element,
    height: propsHeight,
    isFullScreen: propsIsFullScreen,
    isLightTheme,
    width: propsWidth,
  } = props
  const { tooltip, useContainerWidth: shouldUseContainerWidth } = element
  const isFullScreen = propsIsFullScreen ?? false

  const [viewState, setViewState] = useState<Record<string, unknown>>({
    bearing: 0,
    pitch: 0,
    zoom: 11,
  })

  const { height, width } = useStWidthHeight({
    element,
    isFullScreen,
    shouldUseContainerWidth,
    container: { height: propsHeight, width: propsWidth },
    heightFallback:
      (viewState.initialViewState as { height: number } | undefined)?.height ||
      DEFAULT_DECK_GL_HEIGHT,
  })

  const [initialViewState, setInitialViewState] = useState<
    Record<string, unknown>
  >({})

  const parsedPydeckJson = useMemo(() => {
    return Object.freeze(JSON5.parse<StreamlitDeckProps>(element.json))
    // Only parse JSON when transitioning to/from fullscreen, the json changes, or theme changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen, isLightTheme, element.json])

  const deck = useMemo<DeckObject>(() => {
    const copy = { ...parsedPydeckJson }

    // If unset, use either the Mapbox light or dark style based on Streamlit's theme
    // For Mapbox styles, see https://docs.mapbox.com/api/maps/styles/#mapbox-styles
    if (!copy.mapStyle) {
      copy.mapStyle = `mapbox://styles/mapbox/${
        isLightTheme ? "light" : "dark"
      }-v9`
    }

    // Set width and height based on the fullscreen state
    if (isFullScreen) {
      Object.assign(copy.initialViewState, { width, height })
    } else {
      if (!copy.initialViewState.height) {
        copy.initialViewState.height = DEFAULT_DECK_GL_HEIGHT
      }
      if (shouldUseContainerWidth) {
        copy.initialViewState.width = width
      }
    }

    delete copy?.views // We are not using views. This avoids a console warning.

    return jsonConverter.convert(copy)
  }, [
    height,
    isFullScreen,
    isLightTheme,
    parsedPydeckJson,
    shouldUseContainerWidth,
    width,
  ])

  useEffect(() => {
    // If the ViewState on the server has changed, apply the diff to the current state
    if (!isEqual(deck.initialViewState, initialViewState)) {
      const diff = Object.keys(deck.initialViewState).reduce(
        (diff, key): any => {
          // @ts-expect-error
          if (deck.initialViewState[key] === initialViewState[key]) {
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

      setViewState({ ...viewState, ...diff })
      setInitialViewState(deck.initialViewState)
    }
  }, [deck.initialViewState, initialViewState, viewState])

  const createTooltip = useCallback(
    (info: PickingInfo | null): TooltipContent => {
      if (!info || !info.object || !tooltip) {
        return null
      }

      const parsedTooltip = JSON5.parse(tooltip)

      if (parsedTooltip.html) {
        parsedTooltip.html = interpolate(info, parsedTooltip.html)
      } else {
        parsedTooltip.text = interpolate(info, parsedTooltip.text)
      }

      return parsedTooltip
    },
    [tooltip]
  )

  const onViewStateChange = useCallback(
    ({ viewState }: ViewStateChangeParameters) => {
      setViewState(viewState)
    },
    [setViewState]
  )

  return {
    createTooltip,
    deck,
    height,
    onViewStateChange,
    viewState,
    width,
  }
}
