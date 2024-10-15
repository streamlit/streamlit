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

import type { DeckProps } from "@deck.gl/core"

import type { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"

export type StreamlitDeckProps = DeckProps & {
  mapStyle?: string
}

type SerializedLayer = {
  /** @see https://deck.gl/docs/api-reference/json/conversion-reference */
  "@@type": string
  id?: string
  /** @see https://deck.gl/docs/developer-guide/performance#use-updatetriggers */
  updateTriggers?: Record<string, unknown[]>
} & Record<string, unknown>

export type ParsedDeckGlConfig = {
  layers: SerializedLayer[]
  mapStyle?: string
  initialViewState: DeckProps["initialViewState"]
  views: DeckProps["views"]
}

export interface DeckGLProps {
  disabled?: boolean
  disableFullscreenMode?: boolean
  element: DeckGlJsonChartProto
  fragmentId: string | undefined
  mapboxToken: string
  widgetMgr: WidgetStateManager
}

export interface DeckObject {
  initialViewState: {
    height: number
    width: number
  }
  layers: DeckProps["layers"]
  mapStyle?: string | Array<string>
}

/**
 * @see PydeckState in the backend for the corresponding Python type.
 */
export type DeckGlElementState = {
  selection: {
    indices: { [layerId: string]: number[] }
    objects: { [layerId: string]: unknown[] }
  }
}
