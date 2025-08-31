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

import {
  IAppPage,
  ICustomThemeConfig,
  MetricsEvent,
} from "@streamlit/protobuf"

import { ScriptRunState } from "~lib/ScriptRunState"
import { ExportedTheme } from "~lib/theme"
import { PresetThemeName } from "~lib/theme/types"

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
  /**
   * Whether host wants to block error dialogs. If true, blocks error dialogs
   * from being shown to the user, sends error info to host via postMessage
   */
  blockErrorDialogs?: boolean
}

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
      type: "REDIRECT_TO_URL"
      url: string
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
  | {
      type: "METRICS_EVENT"
      eventName: string
      data: MetricsEvent
    }
  | {
      type: "CLIENT_ERROR_DIALOG"
      error: string
      message?: string
    }
  | {
      type: "CLIENT_ERROR"
      component: string
      error: string | number
      message: string
      source: string
      customComponentName?: string
    }

export type VersionedMessage<Message> = {
  stCommVersion: number
} & Message
