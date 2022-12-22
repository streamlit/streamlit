/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { IAppPage } from "src/autogen/proto"
import { ExportedTheme } from "src/theme"

export type DeployedAppMetadata = {
  hostedAt?: string
  creatorId?: string
  owner?: string
  branch?: string
  repo?: string
  mainModule?: string
  isOwner?: boolean
}

export interface HostCommunicationState {
  authTokenPromise: Promise<string | undefined>
  deployedAppMetadata: DeployedAppMetadata
  forcedModalClose: boolean
  hideSidebarNav: boolean
  isOwner: boolean
  menuItems: IMenuItem[]
  pageLinkBaseUrl: string
  queryParams: string
  requestedPageScriptHash: string | null
  sidebarChevronDownshift: number
  toolbarItems: IToolbarItem[]
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
)

export type IGuestToHostMessage =
  | {
      type: "GUEST_READY"
    }
  | {
      type: "SCRIPT_RUN_FINISHED"
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

export type VersionedMessage<Message> = {
  stCommVersion: number
} & Message

export type IAllowedMessageOriginsResponse = {
  allowedOrigins: string[]
  useExternalAuthToken: boolean
}
