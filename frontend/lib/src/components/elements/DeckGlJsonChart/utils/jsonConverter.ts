/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import * as aggregationLayers from "@deck.gl/aggregation-layers"
import {
  CARTO_LAYERS,
  colorBins,
  colorCategories,
  colorContinuous,
} from "@deck.gl/carto"
import {
  _GlobeView,
  FirstPersonView,
  MapView,
  OrbitView,
  OrthographicView,
} from "@deck.gl/core"
import * as deckExtensions from "@deck.gl/extensions"
import * as geoLayers from "@deck.gl/geo-layers"
import { JSONConverter } from "@deck.gl/json"
import * as layers from "@deck.gl/layers"
import * as meshLayers from "@deck.gl/mesh-layers"
import { getLogger } from "loglevel"

import { isNullOrUndefined } from "~lib/util/utils"

const LOG = getLogger("DeckGlJsonChart")

const extensionClasses = {
  ...deckExtensions,
  // pydeck JSON uses "TerrainExtension"; deck.gl exports it as _TerrainExtension.
  TerrainExtension: deckExtensions._TerrainExtension,
}

const REGISTERED_EXTENSION_TYPES = new Set(
  Object.entries(extensionClasses)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name)
)

const configuration = {
  classes: {
    ...layers,
    ...aggregationLayers,
    ...geoLayers,
    ...meshLayers,
    ...CARTO_LAYERS,
    ...extensionClasses,
    // Named imports only; @deck.gl/core also exports non-classes.
    MapView,
    OrbitView,
    OrthographicView,
    FirstPersonView,
    _GlobeView,
    GlobeView: _GlobeView, // docs alias; export is still experimental
  },
  functions: {
    colorBins,
    colorCategories,
    colorContinuous,
  },
}

export const jsonConverter = new JSONConverter({ configuration })

type JsonObject = Record<string, unknown>

const isRegisteredExtensionJson = (extension: unknown): boolean => {
  if (isNullOrUndefined(extension) || typeof extension !== "object") {
    return false
  }

  const type = (extension as JsonObject)["@@type"]
  return typeof type === "string" && REGISTERED_EXTENSION_TYPES.has(type)
}

const describeExtension = (extension: unknown): string => {
  if (isNullOrUndefined(extension) || typeof extension !== "object") {
    return String(extension)
  }

  const type = (extension as JsonObject)["@@type"]
  return typeof type === "string" ? type : "(missing @@type)"
}

/**
 * Drop unregistered or malformed layer extensions before convert.
 *
 * JSONConverter hydrates unknown `@@type` values to `null`. deck.gl then
 * throws while merging extension default props, which replaces the chart
 * with a frontend error box. Skipping those entries keeps the rest of the
 * layer.
 */
const dropUnregisteredExtensions = (json: JsonObject): JsonObject => {
  const { layers: jsonLayers } = json
  if (!Array.isArray(jsonLayers)) {
    return json
  }

  return {
    ...json,
    layers: jsonLayers.map(layer => {
      if (
        isNullOrUndefined(layer) ||
        typeof layer !== "object" ||
        Array.isArray(layer)
      ) {
        return layer
      }

      const layerObj = layer as JsonObject
      if (!Array.isArray(layerObj.extensions)) {
        return layer
      }

      const kept = layerObj.extensions.filter(isRegisteredExtensionJson)
      if (kept.length === layerObj.extensions.length) {
        return layer
      }

      const dropped = layerObj.extensions
        .filter(extension => !isRegisteredExtensionJson(extension))
        .map(describeExtension)
      LOG.warn(
        `Ignoring unregistered deck.gl layer extension(s): ${dropped.join(", ")}`
      )

      return { ...layerObj, extensions: kept }
    }),
  }
}

export const convertDeckJson = (json: unknown): unknown => {
  if (
    isNullOrUndefined(json) ||
    typeof json !== "object" ||
    Array.isArray(json)
  ) {
    return jsonConverter.convert(json)
  }

  return jsonConverter.convert(dropUnregisteredExtensions(json as JsonObject))
}
