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
import { PickingInfo } from "@deck.gl/core/typed"
import isEqual from "lodash/isEqual"
import { ViewStateChangeParameters } from "@deck.gl/core/typed/controllers/controller"
import { TooltipContent } from "@deck.gl/core/typed/lib/tooltip"
import { parseToRgba } from "color2k"

import { useStWidthHeight } from "@streamlit/lib/src/hooks/useStWidthHeight"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"
import {
  useBasicWidgetClientState,
  ValueWSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"

import type {
  DeckGlElementState,
  DeckGLProps,
  DeckObject,
  ParsedDeckGlConfig,
} from "./types"
import { jsonConverter } from "./utils/jsonConverter"
import {
  FillFunction,
  getContextualFillColor,
  LAYER_TYPE_TO_FILL_FUNCTION,
} from "./utils/colors"

type UseDeckGlShape = {
  createTooltip: (info: PickingInfo | null) => TooltipContent
  deck: DeckObject
  height: number | string
  onViewStateChange: (params: ViewStateChangeParameters) => void
  setSelection: React.Dispatch<
    React.SetStateAction<ValueWSource<DeckGlElementState> | null>
  >
  data: DeckGlElementState
  viewState: Record<string, unknown>
  width: number | string
}

export type UseDeckGlProps = Omit<DeckGLProps, "mapboxToken"> & {
  isLightTheme: boolean
  theme: EmotionTheme
}

const DEFAULT_DECK_GL_HEIGHT = 500

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

function getDefaultState(
  widgetMgr: WidgetStateManager,
  element: DeckGlJsonChartProto
): DeckGlElementState {
  if (!element.id) {
    return { selection: null }
  }

  const initialFigureState = widgetMgr.getElementState(element.id, "selection")

  return initialFigureState ?? {}
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DeckGlJsonChartProto
): DeckGlElementState {
  if (!element.id) {
    return { selection: null }
  }

  // return widgetMgr.getElementState(element.id, "selection")
  const stringValue = widgetMgr.getStringValue(element)
  const currState: DeckGlElementState | null = stringValue
    ? JSON5.parse(stringValue)
    : null

  return currState ?? { selection: null }
}

function updateWidgetMgrState(
  element: DeckGlJsonChartProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWSource<DeckGlElementState>,
  fragmentId?: string
): void {
  if (!element.id) {
    return
  }

  // widgetMgr.setElementState(element.id, "selection", vws)
  widgetMgr.setStringValue(
    element,
    JSON.stringify(vws.value),
    { fromUi: vws.fromUi },
    fragmentId
  )
}

export const useDeckGl = (props: UseDeckGlProps): UseDeckGlShape => {
  const {
    element,
    fragmentId,
    height: propsHeight,
    isFullScreen: propsIsFullScreen,
    isLightTheme,
    theme,
    widgetMgr,
    width: propsWidth,
  } = props
  const { tooltip, useContainerWidth: shouldUseContainerWidth } = element
  const isFullScreen = propsIsFullScreen ?? false

  const [data, setSelection] = useBasicWidgetClientState<
    DeckGlElementState,
    DeckGlJsonChartProto
  >({
    element,
    getDefaultState,
    getStateFromWidgetMgr,
    updateWidgetMgrState,
    widgetMgr,
    fragmentId,
  })

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
    return Object.freeze(JSON5.parse<ParsedDeckGlConfig>(element.json))
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

    if (copy.layers) {
      const anyLayersHaveSelection = Object.values(data?.selection || {}).some(
        layer => layer?.indices?.length
      )

      copy.layers = copy.layers.map(layer => {
        if (!layer || Array.isArray(layer)) {
          return layer
        }

        const layerId = `${layer.id || null}`
        const selectedIndices = data?.selection?.[layerId]?.indices || []

        const fillFunction = LAYER_TYPE_TO_FILL_FUNCTION[layer["@@type"]]

        if (!fillFunction || !Object.hasOwn(layer, fillFunction)) {
          return layer
        }

        const clonedLayer = { ...layer }
        clonedLayer.updateTriggers = {
          // Tell Deck.gl to recompute the fill color when the selection changes.
          // Without this, objects in layers will have stale colors when selection changes.
          // @see https://deck.gl/docs/api-reference/core/layer#updatetriggers
          [fillFunction]: [
            ...(clonedLayer.updateTriggers?.[fillFunction] || []),
            selectedIndices,
            anyLayersHaveSelection,
          ],
        }

        const shouldUseOriginalFillFunction = !anyLayersHaveSelection

        if (shouldUseOriginalFillFunction) {
          // If we aren't changing the fill color, we don't need to change the fillFunction
          return clonedLayer
        }

        const originalFillFunction = layer[fillFunction] as FillFunction

        const selectedColor = parseToRgba(theme.colors.primary)
        const unselectedColor = parseToRgba(theme.colors.gray20)

        const newFillFunction: FillFunction = (object, objectInfo) => {
          return getContextualFillColor({
            isSelected: selectedIndices.includes(objectInfo.index),
            object,
            objectInfo,
            originalFillFunction,
            selectedColor,
            unselectedColor,
          })
        }

        clonedLayer[fillFunction] = newFillFunction

        return clonedLayer
      })
    }

    delete copy?.views // We are not using views. This avoids a console warning.

    return jsonConverter.convert(copy)
  }, [
    height,
    isFullScreen,
    isLightTheme,
    parsedPydeckJson,
    data,
    shouldUseContainerWidth,
    theme.colors.gray20,
    theme.colors.primary,
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
    data,
    setSelection,
    viewState,
    width,
  }
}
