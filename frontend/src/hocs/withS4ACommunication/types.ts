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
      type: "SET_MENU_ITEMS"
      items: IMenuItem[]
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
      type: "SET_PAGE_TITLE"
      title: string
    }
  | {
      type: "SET_PAGE_FAVICON"
      favicon: string
    }
  | {
      type: "SET_QUERY_PARAM"
      queryParams: string
    }
  | {
      type: "UPDATE_HASH"
      hash: string
    }

export type VersionedMessage<Message> = {
  stCommVersion: number
} & Message
