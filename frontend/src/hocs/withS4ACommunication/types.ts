import { IAppPage } from "src/autogen/proto"
import { ExportedTheme } from "src/theme"

export type StreamlitShareMetadata = {
  hostedAt?: string
  creatorId?: string
  owner?: string
  branch?: string
  repo?: string
  mainModule?: string
  isOwner?: boolean
}

export interface S4ACommunicationState {
  forcedModalClose: boolean
  hideSidebarNav: boolean
  isOwner: boolean
  menuItems: IMenuItem[]
  pageLinkBaseUrl: string
  queryParams: string
  requestedPageScriptHash: string | null
  sidebarChevronDownshift: number
  streamlitShareMetadata: StreamlitShareMetadata
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
      type: "SET_IS_OWNER"
      isOwner: boolean
    }
  | {
      type: "SET_MENU_ITEMS"
      items: IMenuItem[]
    }
  | {
      type: "SET_METADATA"
      metadata: StreamlitShareMetadata
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
