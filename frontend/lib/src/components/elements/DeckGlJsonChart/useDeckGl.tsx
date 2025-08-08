/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import {
  type DeckProps,
  PickingInfo,
  ViewStateChangeParameters,
} from "@deck.gl/core"
import { parseToRgba } from "color2k"
import JSON5 from "json5"
import isEqual from "lodash/isEqual"

import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import {
  useBasicWidgetClientState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { useStWidthHeight } from "~lib/hooks/useStWidthHeight"
import { EmotionTheme } from "~lib/theme"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import type {
  DeckGlElementState,
  DeckGLProps,
  DeckObject,
  ParsedDeckGlConfig,
} from "./types"
import {
  FillFunction,
  getContextualFillColor,
  LAYER_TYPE_TO_FILL_FUNCTION,
} from "./utils/colors"
import { jsonConverter } from "./utils/jsonConverter"

/**
 * Extracted type from the DeckGL library since it is not exported correctly.
 */
type TooltipContent =
  NonNullable<DeckProps["getTooltip"]> extends (info: PickingInfo) => infer R
    ? R
    : never

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
  viewState: Record<string, unknown> | null
  width: number | string
}

export type UseDeckGlProps = Omit<DeckGLProps, "width"> & {
  isLightTheme: boolean
  theme: EmotionTheme
}

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

      if (Object.hasOwn(info.object, variable)) {
        body = body.replace(match, info.object[variable])
      } else if (
        Object.hasOwn(info.object, "properties") &&
        Object.hasOwn(info.object.properties, variable)
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

  const [viewState, setViewState] = useState<Record<string, unknown> | null>(
    null
  )

  const { height, width } = useStWidthHeight({
    element,
    isFullScreen,
    shouldUseContainerWidth,
    container: { height: propsHeight, width: propsWidth },
    heightFallback:
      (viewState?.initialViewState as { height: number } | undefined)
        ?.height || theme.sizes.defaultMapHeight,
  })

  const [initialViewState, setInitialViewState] = useState<Record<
    string,
    unknown
  > | null>(null)

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
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen, isLightTheme, element.json])

  const deck = useMemo<DeckObject>(() => {
    const jsonCopy = { ...parsedPydeckJson }

    // If unset, use either the light or dark style based on Streamlit's theme.
    if (!jsonCopy.mapStyle) {
      jsonCopy.mapStyle = isLightTheme
        ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    }

    const isUsingCarto =
      jsonCopy?.mapProvider == "carto" ||
      (jsonCopy?.mapStyle && jsonCopy.mapStyle?.indexOf("cartocdn") >= 0)

    if (isUsingCarto && !jsonCopy.cartoKey) {
      // This key was manually created by Carto just for Streamlit. It is NOT
      // connected to any paid accounts, or secure API access, or anything of
      // the sort. It's is just used for Carto to be able to separate Streamlit
      // usage from other types in their own internal stats.
      jsonCopy.cartoKey = "x7g2plm9yq8vfrc"
    }

    if (jsonCopy.layers) {
      const anyLayersHaveSelection = Object.values(
        data.selection.indices
      ).some(layer => layer?.length)

      const anyLayersHavePickableDefined = jsonCopy.layers.some(layer =>
        Object.hasOwn(layer, "pickable")
      )

      jsonCopy.layers = jsonCopy.layers.map(layer => {
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

    delete jsonCopy?.views // We are not using views. This avoids a console warning.

    return jsonConverter.convert(jsonCopy)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
        (diffArg, key): any => {
          // @ts-expect-error
          if (deck.initialViewState[key] === initialViewState?.[key]) {
            return diffArg
          }

          return {
            ...diffArg,
            // @ts-expect-error
            [key]: deck.initialViewState[key],
          }
        },
        {}
      )

      setViewState(existing => ({ ...existing, ...diff }))
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
    ({ viewState: viewStateArg }: ViewStateChangeParameters) => {
      setViewState(viewStateArg)
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
