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

import * as layers from "@deck.gl/layers"
import * as geoLayers from "@deck.gl/geo-layers"
import * as meshLayers from "@deck.gl/mesh-layers"

import { jsonConverter } from "./jsonConverter"

/**
 * @file Utilities for determining fill colors for layers based on their
 *      selection state and the layer's selection color mode.
 */

/**
 * Maps the "@@type" of a layer to the corresponding fill functions.
 *
 * Note that this mapping is not exhaustive and only includes the layers that we
 * can actually change the color of.
 */
export const LAYER_TYPE_TO_FILL_FUNCTION = {
  [geoLayers.GeohashLayer.layerName]: ["getFillColor"],
  [geoLayers.H3ClusterLayer.layerName]: ["getFillColor"],
  [geoLayers.H3HexagonLayer.layerName]: ["getFillColor"],
  [geoLayers.MVTLayer.layerName]: ["getFillColor"],
  [geoLayers.QuadkeyLayer.layerName]: ["getFillColor"],
  [geoLayers.S2Layer.layerName]: ["getFillColor"],
  [geoLayers.TripsLayer.layerName]: ["getColor"],
  [layers.ArcLayer.layerName]: ["getTargetColor", "getSourceColor"],
  [layers.ColumnLayer.layerName]: ["getFillColor"],
  [layers.GeoJsonLayer.layerName]: ["getFillColor"],
  [layers.IconLayer.layerName]: ["getColor"],
  [layers.LineLayer.layerName]: ["getColor"],
  [layers.PathLayer.layerName]: ["getColor"],
  [layers.PointCloudLayer.layerName]: ["getColor"],
  [layers.PolygonLayer.layerName]: ["getFillColor"],
  [layers.ScatterplotLayer.layerName]: [
    "getFillColor",
    "getColor",
    "getLineColor",
  ],
  [layers.SolidPolygonLayer.layerName]: ["getFillColor"],
  [layers.TextLayer.layerName]: ["getColor"],
  [meshLayers.ScenegraphLayer.layerName]: ["getColor"],
  [meshLayers.SimpleMeshLayer.layerName]: ["getColor"],
}

type SerializedColorValue = string | number
export type SerializedColorArray = [
  SerializedColorValue?,
  SerializedColorValue?,
  SerializedColorValue?,
  SerializedColorValue?
]

type ObjectCallbackShape<T = unknown> = {
  object: T
  objectInfo: { index: number }
}

export type FillFunction<T = unknown> = (
  object: ObjectCallbackShape<T>["object"],
  objectInfo: ObjectCallbackShape<T>["objectInfo"]
) => SerializedColorArray | SerializedColorValue

type FillFunctionArgs<T = unknown> = ObjectCallbackShape<T> & {
  originalFillFunction: FillFunction<T> | undefined
}

/**
 * Retrieves the original color in a standardized format by evaluating functions
 * if necessary.
 */
const getOriginalColor = ({
  object,
  objectInfo,
  originalFillFunction,
}: FillFunctionArgs): SerializedColorArray | null => {
  const originalColor =
    typeof originalFillFunction === "function"
      ? originalFillFunction(object, objectInfo)
      : originalFillFunction

  if (Array.isArray(originalColor)) {
    return [
      originalColor[0] || 0,
      originalColor[1] || 0,
      originalColor[2] || 0,
      originalColor[3] || 255,
    ]
  }

  if (typeof originalColor === "string" && originalColor.startsWith("@@=")) {
    // @see https://deck.gl/docs/api-reference/json/conversion-reference#functions-and-using-the--prefix

    const evaluated = jsonConverter
      .convert({ originalColor })
      .originalColor(object)

    return [
      evaluated[0] || 0,
      evaluated[1] || 0,
      evaluated[2] || 0,
      evaluated[3] || 255,
    ]
  }

  return null
}

/**
 * Calculates the original color with the applied opacity based on the selection
 * mode.
 *
 * @param {boolean} isSelected - Indicates if the object is selected.
 * @param {number} opacity - The opacity to apply.
 * @param {object} object - The object for which the color is being calculated.
 * @param {object} objectInfo - Additional information about the object.
 * @param {Function} originalFillFunction - The function to get the original
 * fill color.
 * @returns {SerializedColorArray | null} The color with the applied opacity or
 * null if the original color is not available.
 */
const getOriginalColorWithAppliedOpacity = ({
  isSelected,
  object,
  objectInfo,
  opacity,
  originalFillFunction,
}: {
  isSelected: boolean
  opacity: number
} & FillFunctionArgs): SerializedColorArray | null => {
  const originalColor = getOriginalColor({
    object,
    objectInfo,
    originalFillFunction,
  })

  if (!originalColor) {
    return null
  }

  let calculatedOpacity = 0

  if (isSelected) {
    // Some layers will have objects where the opacity is lower than the default
    // selected opacity In this case, we want to use the higher opacity so that
    // the differentiation between selected and unselected objects is more
    // pronounced
    calculatedOpacity = Math.max(
      typeof originalColor[3] === "number" ? originalColor[3] : opacity,
      opacity
    )
  } else {
    // Some layers will have objects where the opacity is lower than the default
    // unselected opacity In this case, we want to use the lower opacity so that
    // we aren't raising the visibility of objects unnecessarily
    calculatedOpacity = Math.min(
      typeof originalColor[3] === "number" ? originalColor[3] : opacity,
      opacity
    )
  }

  return [
    originalColor[0] || 0,
    originalColor[1] || 0,
    originalColor[2] || 0,
    calculatedOpacity,
  ]
}

/**
 * Determines the fill color for an object based on its selection state and the
 * layer's selection color mode.
 */
export const getContextualFillColor = ({
  isSelected,
  object,
  objectInfo,
  originalFillFunction,
  selectedColor,
  selectedOpacity = 255,
  unselectedColor,
  unselectedOpacity = Math.floor(255 * 0.4),
}: {
  isSelected: boolean
  /** Fallback color in case there are issues in parsing the color for the current object */
  selectedColor: SerializedColorArray
  /** How much opacity should be applied to the selected item. Defaults to 100% */
  selectedOpacity?: number
  /** Fallback color in case there are issues in parsing the color for the current object */
  unselectedColor: SerializedColorArray
  /** How much opacity should be applied to the not selected items. Defaults to 40% */
  unselectedOpacity?: number
} & FillFunctionArgs): SerializedColorArray | SerializedColorValue => {
  if (isSelected) {
    return (
      getOriginalColorWithAppliedOpacity({
        opacity: selectedOpacity,
        isSelected: true,
        object,
        objectInfo,
        originalFillFunction,
      }) || selectedColor
    )
  }

  return (
    getOriginalColorWithAppliedOpacity({
      opacity: unselectedOpacity,
      isSelected: false,
      object,
      objectInfo,
      originalFillFunction,
    }) || unselectedColor
  )
}
