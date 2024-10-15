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
import { PickingInfo, ViewStateChangeParameters } from "@deck.gl/core"
import isEqual from "lodash/isEqual"
import { TooltipContent } from "@deck.gl/core/dist/lib/tooltip"
import { parseToRgba } from "color2k"

import { useStWidthHeight } from "@streamlit/lib/src/hooks/useStWidthHeight"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"
import {
  useBasicWidgetClientState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { useRequiredContext } from "@streamlit/lib/src/hooks/useRequiredContext"
import { ElementFullscreenContext } from "@streamlit/lib/src/components/shared/ElementFullscreen/ElementFullscreenContext"

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
  data: DeckGlElementState
  deck: DeckObject
  hasActiveSelection: boolean
  height: number | string
  isSelectionModeActivated: boolean
  onViewStateChange: (params: ViewStateChangeParameters) => void
  selectionMode: DeckGlJsonChartProto.SelectionMode | undefined
  setSelection: React.Dispatch<
    React.SetStateAction<ValueWithSource<DeckGlElementState> | null>
  >
  viewState: Record<string, unknown>
  width: number | string
}

export type UseDeckGlProps = Omit<DeckGLProps, "mapboxToken"> & {
  isLightTheme: boolean
  theme: EmotionTheme
}

const DEFAULT_DECK_GL_HEIGHT = 500

export const EMPTY_STATE: DeckGlElementState = {
  selection: {
    indices: {},
    objects: {},
  },
}

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
    return EMPTY_STATE
  }

  const initialFigureState = widgetMgr.getElementState(element.id, "selection")

  return initialFigureState ?? EMPTY_STATE
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DeckGlJsonChartProto
): DeckGlElementState {
  if (!element.id) {
    return EMPTY_STATE
  }

  const stringValue = widgetMgr.getStringValue(element)
  const currState: DeckGlElementState | null = stringValue
    ? JSON5.parse(stringValue)
    : null

  return currState ?? EMPTY_STATE
}

function updateWidgetMgrState(
  element: DeckGlJsonChartProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<DeckGlElementState>,
  fragmentId?: string
): void {
  if (!element.id) {
    return
  }

  widgetMgr.setStringValue(
    element,
    JSON.stringify(vws.value),
    { fromUi: vws.fromUi },
    fragmentId
  )
}

export const useDeckGl = (props: UseDeckGlProps): UseDeckGlShape => {
  const {
    height: propsHeight,
    width: propsWidth,
    expanded: propsIsFullScreen,
  } = useRequiredContext(ElementFullscreenContext)

  const { element, fragmentId, isLightTheme, theme, widgetMgr } = props
  const {
    selectionMode: allSelectionModes,
    tooltip,
    useContainerWidth: shouldUseContainerWidth,
  } = element
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

  /**
   * Our proto for selectionMode is an array in order to support future-looking
   * functionality. Currently, we only support 1 single selection mode, so we'll
   * only use the first one (if it exists) to determine our selection mode.
   *
   * @see deck_gl_json_chart.py #parse_selection_mode
   */
  const selectionMode: DeckGlJsonChartProto.SelectionMode | undefined =
    allSelectionModes[0]
  const isSelectionModeActivated = selectionMode !== undefined

  const hasActiveSelection =
    isSelectionModeActivated && Object.keys(data.selection.indices).length > 0

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

    if (copy.layers) {
      const anyLayersHaveSelection = Object.values(
        data.selection.indices
      ).some(layer => layer?.length)

      const anyLayersHavePickableDefined = copy.layers.some(layer =>
        Object.hasOwn(layer, "pickable")
      )

      copy.layers = copy.layers.map(layer => {
        if (
          !layer ||
          Array.isArray(layer) ||
          // If selection mode is not activated, do not make any additional changes to each layer
          !isSelectionModeActivated
        ) {
          return layer
        }

        if (!anyLayersHavePickableDefined) {
          // If selection mode is activated and no layers have pickable defined,
          // set pickable to true for every layer. This is something Streamlit
          // does to help make map selection easier to work with out of the box.
          layer.pickable = true
        }

        const layerId = `${layer.id || null}`
        const selectedIndices = data?.selection?.indices?.[layerId] || []

        const fillFunctions = LAYER_TYPE_TO_FILL_FUNCTION[layer["@@type"]]

        if (!fillFunctions) {
          return layer
        }

        const clonedLayer = { ...layer }
        fillFunctions.forEach(fillFunction => {
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

          const originalFillFunction = layer[fillFunction] as
            | FillFunction
            | undefined

          if (shouldUseOriginalFillFunction || !originalFillFunction) {
            // If we aren't changing the fill color, we don't need to change the fillFunction
            return clonedLayer
          }

          const selectedOpacity = 255
          const unselectedOpacity = Math.floor(255 * 0.4)

          // Fallback colors in case there are issues while parsing the colors for a given object
          const selectedColorParsed = parseToRgba(theme.colors.primary)
          const selectedColor: [number, number, number, number] = [
            selectedColorParsed[0],
            selectedColorParsed[1],
            selectedColorParsed[2],
            selectedOpacity,
          ]
          const unselectedColorParsed = parseToRgba(theme.colors.gray20)
          const unselectedColor: [number, number, number, number] = [
            unselectedColorParsed[0],
            unselectedColorParsed[1],
            unselectedColorParsed[2],
            unselectedOpacity,
          ]

          const newFillFunction: FillFunction = (object, objectInfo) => {
            return getContextualFillColor({
              isSelected: selectedIndices.includes(objectInfo.index),
              object,
              objectInfo,
              originalFillFunction,
              selectedColor,
              unselectedColor,
              selectedOpacity,
              unselectedOpacity,
            })
          }

          clonedLayer[fillFunction] = newFillFunction
        })

        return clonedLayer
      })
    }

    delete copy?.views // We are not using views. This avoids a console warning.

    return jsonConverter.convert(copy)
  }, [
    data.selection.indices,
    isLightTheme,
    isSelectionModeActivated,
    parsedPydeckJson,
    theme.colors.gray20,
    theme.colors.primary,
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
    data,
    deck,
    hasActiveSelection,
    height,
    isSelectionModeActivated,
    onViewStateChange,
    selectionMode,
    setSelection,
    viewState,
    width,
  }
}
