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

import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { Ellipses, Warning } from "@emotion-icons/open-iconic"

import { ConnectionState } from "@streamlit/connection"

interface ConnectionStateUI {
  icon: EmotionIcon
  label: string
  tooltip: string
}

export const CONNECTING_LABEL = "Connecting"
export const CONNECTING_TOOLTIP_TEXT = "Connecting to Streamlit server"
export const CONNECTING_STATIC_TOOLTIP_TEXT = "Connecting to static app"
export const ERROR_LABEL = "Error"
export const ERROR_TOOLTIP_TEXT = "Unable to connect to Streamlit server"

export function getConnectionStateUI(
  state: ConnectionState
): ConnectionStateUI | undefined {
  switch (state) {
    case ConnectionState.INITIAL:
    case ConnectionState.PINGING_SERVER:
    case ConnectionState.CONNECTING:
      return {
        icon: Ellipses,
        label: CONNECTING_LABEL,
        tooltip: CONNECTING_TOOLTIP_TEXT,
      }
    case ConnectionState.CONNECTED:
      return undefined
    case ConnectionState.STATIC_CONNECTING:
      return {
        icon: Ellipses,
        label: CONNECTING_LABEL,
        tooltip: CONNECTING_STATIC_TOOLTIP_TEXT,
      }
    case ConnectionState.STATIC_CONNECTED:
      return undefined
    case ConnectionState.DISCONNECTED_FOREVER:
    default:
      return {
        icon: Warning,
        label: ERROR_LABEL,
        tooltip: ERROR_TOOLTIP_TEXT,
      }
  }
}
