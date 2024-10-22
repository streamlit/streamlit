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

import { IAppPage, ICustomThemeConfig } from "@streamlit/lib/src/proto"
import { ExportedTheme } from "@streamlit/lib/src/theme"
import { ScriptRunState } from "@streamlit/lib/src/ScriptRunState"
import { LibConfig } from "@streamlit/lib/src/components/core/LibContext"
import { PresetThemeName } from "@streamlit/lib/src/theme/types"

export type DeployedAppMetadata = {
  hostedAt?: string
  creatorId?: string
  owner?: string
  branch?: string
  repo?: string
  mainModule?: string
  isOwner?: boolean
}

export type IToolbarItem = {
  borderless?: boolean
  icon?: string
  key: string
  label?: string
}

export type IMenuItem =
  | {
      type: "text"
      label: string
      key: string
    }
  | {
      type: "separator"
    }

export type IHostToGuestMessage = {
  stCommVersion: number
} & (
  | {
      type: "CLOSE_MODALS"
    }
  | {
      type: "REQUEST_PAGE_CHANGE"
      pageScriptHash: string
    }
  | {
      type: "SET_INPUTS_DISABLED"
      disabled: boolean
    }
  | {
      type: "SET_AUTH_TOKEN"
      authToken: string
      jwtHeaderName?: string
      jwtHeaderValue?: string
    }
  | {
      type: "SET_IS_OWNER"
      isOwner: boolean
    }
  | {
      type: "SET_MENU_ITEMS"
      items: IMenuItem[]
    }
  | {
      type: "SET_METADATA"
      metadata: DeployedAppMetadata
    }
  | {
      type: "SET_PAGE_LINK_BASE_URL"
      pageLinkBaseUrl: string
    }
  | {
      type: "SET_SIDEBAR_CHEVRON_DOWNSHIFT"
      sidebarChevronDownshift: number
    }
  | {
      type: "SET_SIDEBAR_NAV_VISIBILITY"
      hidden: boolean
    }
  | {
      type: "SET_TOOLBAR_ITEMS"
      items: IToolbarItem[]
    }
  | {
      type: "UPDATE_FROM_QUERY_PARAMS"
      queryParams: string
    }
  | {
      type: "UPDATE_HASH"
      hash: string
    }
  | {
      type: "STOP_SCRIPT"
    }
  | {
      type: "RERUN_SCRIPT"
    }
  | {
      type: "CLEAR_CACHE"
    }
  | {
      type: "SET_CUSTOM_THEME_CONFIG"
      themeName?: PresetThemeName
      // TODO: Consider removing themeInfo once stakeholders no longer use it
      themeInfo?: ICustomThemeConfig
    }
  | {
      type: "SEND_APP_HEARTBEAT"
    }
  | {
      type: "RESTART_WEBSOCKET_CONNECTION"
    }
  | {
      type: "TERMINATE_WEBSOCKET_CONNECTION"
    }
)

export type IGuestToHostMessage =
  | {
      type: "GUEST_READY"
      streamlitExecutionStartedAt: number
      guestReadyAt: number
    }
  | {
      type: "MENU_ITEM_CALLBACK"
      key: string
    }
  | {
      type: "TOOLBAR_ITEM_CALLBACK"
      key: string
    }
  | {
      type: "SET_APP_PAGES"
      appPages: IAppPage[]
    }
  | {
      type: "SET_CURRENT_PAGE_NAME"
      currentPageName: string
      currentPageScriptHash: string
    }
  | {
      type: "SET_PAGE_FAVICON"
      favicon: string
    }
  | {
      type: "SET_PAGE_TITLE"
      title: string
    }
  | {
      type: "SET_QUERY_PARAM"
      queryParams: string
    }
  | {
      type: "SET_THEME_CONFIG"
      themeInfo: ExportedTheme
    }
  | {
      type: "UPDATE_HASH"
      hash: string
    }
  | {
      type: "SCRIPT_RUN_STATE_CHANGED"
      scriptRunState: ScriptRunState
    }
  | {
      type: "CUSTOM_PARENT_MESSAGE"
      message: string
    }
  | {
      type: "WEBSOCKET_DISCONNECTED"
      attemptingToReconnect: boolean
      // TODO(vdonato): Maybe provide a reason the disconnect happened. This
      // could either be a WS disconnect code or a flag signifying the host
      // requested this websocket disconnect.
    }
  | {
      type: "WEBSOCKET_CONNECTED"
    }

export type VersionedMessage<Message> = {
  stCommVersion: number
} & Message

/**
 * The app config contains various configurations that the host platform can
 * use to configure streamlit-app frontend behavior. This should to be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 *
 * TODO(lukasmasuch): Potentially refactor HostCommunicationManager and move this type
 * to AppContext.tsx.
 */
export type AppConfig = {
  /**
   * A list of origins that we're allowed to receive cross-iframe messages
   * from via the browser's window.postMessage API.
   */
  allowedOrigins?: string[]
  /**
   * Whether to wait until we've received a SET_AUTH_TOKEN message before
   * resolving deferredAuthToken.promise. The WebsocketConnection class waits
   * for this promise to resolve before attempting to establish a connection
   * with the Streamlit server.
   */
  useExternalAuthToken?: boolean
  /**
   * Enables custom string messages to be sent to the host
   */
  enableCustomParentMessages?: boolean
}

export type MetricsConfig = {
  /**
   * URL to send metrics data to via POST request.
   * Setting to "postMessage" sends metrics events via postMessage to host.
   * Setting to "off" disables metrics collection.
   */
  metricsUrl?: string | "postMessage" | "off"
}

/**
 * The response structure of the `_stcore/host-config` endpoint.
 * This combines streamlit-lib specific configuration options with
 * streamlit-app specific options (e.g. allowed message origins).
 */
export type IHostConfigResponse = LibConfig & AppConfig & MetricsConfig
