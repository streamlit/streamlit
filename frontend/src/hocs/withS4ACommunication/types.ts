/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type StreamlitShareMetadata = {
  hostedAt?: string
  creatorId?: string
  owner?: string
  branch?: string
  repo?: string
  mainModule?: string
  isOwner?: boolean
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
      type: "SET_MENU_ITEMS"
      items: IMenuItem[]
    }
  | {
      type: "UPDATE_FROM_QUERY_PARAMS"
      queryParams: string
    }
  | {
      type: "CLOSE_MODALS"
    }
  | {
      type: "SET_METADATA"
      metadata: StreamlitShareMetadata
    }
  | {
      type: "UPDATE_HASH"
      hash: string
    }
  | {
      type: "SET_IS_OWNER"
      isOwner: boolean
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
