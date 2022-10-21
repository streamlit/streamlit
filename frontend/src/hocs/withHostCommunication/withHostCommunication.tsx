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

import React, { ComponentType, useState, useEffect, ReactElement } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"

import { CLOUD_COMM_WHITELIST } from "src/urls"
import { isValidURL } from "src/lib/UriUtil"

import {
  IGuestToHostMessage,
  IHostToGuestMessage,
  IMenuItem,
  IToolbarItem,
  VersionedMessage,
  HostCommunicationState,
} from "./types"

export interface HostCommunicationHOC {
  currentState: HostCommunicationState
  connect: () => void
  sendMessage: (message: IGuestToHostMessage) => void
  onModalReset: () => void
  onPageChanged: () => void
}

export const HOST_COMM_VERSION = 1

export function sendMessageToHost(message: IGuestToHostMessage): void {
  window.parent.postMessage(
    {
      stCommVersion: HOST_COMM_VERSION,
      ...message,
    } as VersionedMessage<IGuestToHostMessage>,
    "*"
  )
}

function withHostCommunication(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  function ComponentWithHostCommunication(props: any): ReactElement {
    // TODO(vdonato): Refactor this to use useReducer to make this less
    // unwieldy. We may want to consider installing the redux-toolkit package
    // even if we're not using redux just because it's so useful for reducing
    // this type of boilerplate.
    const [authToken, setAuthToken] = useState<string | undefined>(undefined)
    const [forcedModalClose, setForcedModalClose] = useState(false)
    const [hideSidebarNav, setHideSidebarNav] = useState(false)
    const [isOwner, setIsOwner] = useState(false)
    const [menuItems, setMenuItems] = useState<IMenuItem[]>([])
    const [pageLinkBaseUrl, setPageLinkBaseUrl] = useState("")
    const [queryParams, setQueryParams] = useState("")
    const [requestedPageScriptHash, setRequestedPageScriptHash] = useState<
      string | null
    >(null)
    const [sidebarChevronDownshift, setSidebarChevronDownshift] = useState(0)
    const [deployedAppMetadata, setDeployedAppMetadata] = useState({})
    const [toolbarItems, setToolbarItems] = useState<IToolbarItem[]>([])

    useEffect(() => {
      function receiveMessage(event: MessageEvent): void {
        let origin: string
        const message: VersionedMessage<IHostToGuestMessage> | any = event.data

        try {
          const url = new URL(event.origin)

          origin = url.hostname
        } catch (e) {
          origin = event.origin
        }

        if (
          !origin ||
          message.stCommVersion !== HOST_COMM_VERSION ||
          !CLOUD_COMM_WHITELIST.find(el => isValidURL(el, origin))
        ) {
          return
        }

        if (message.type === "CLOSE_MODAL") {
          setForcedModalClose(true)
        }

        if (message.type === "REQUEST_PAGE_CHANGE") {
          setRequestedPageScriptHash(message.pageScriptHash)
        }

        if (message.type === "SET_AUTH_TOKEN") {
          setAuthToken(message.authToken)
        }

        if (message.type === "SET_IS_OWNER") {
          setIsOwner(message.isOwner)
        }

        if (message.type === "SET_MENU_ITEMS") {
          setMenuItems(message.items)
        }

        if (message.type === "SET_METADATA") {
          setDeployedAppMetadata(message.metadata)
        }

        if (message.type === "SET_PAGE_LINK_BASE_URL") {
          setPageLinkBaseUrl(message.pageLinkBaseUrl)
        }

        if (message.type === "SET_SIDEBAR_CHEVRON_DOWNSHIFT") {
          setSidebarChevronDownshift(message.sidebarChevronDownshift)
        }

        if (message.type === "SET_SIDEBAR_NAV_VISIBILITY") {
          setHideSidebarNav(message.hidden)
        }

        if (message.type === "SET_TOOLBAR_ITEMS") {
          setToolbarItems(message.items)
        }

        if (message.type === "UPDATE_FROM_QUERY_PARAMS") {
          setQueryParams(message.queryParams)
        }

        if (message.type === "UPDATE_HASH") {
          window.location.hash = message.hash
        }
      }

      window.addEventListener("message", receiveMessage)

      return () => {
        window.removeEventListener("message", receiveMessage)
      }
    }, [])

    return (
      <WrappedComponent
        hostCommunication={
          {
            currentState: {
              authToken,
              forcedModalClose,
              hideSidebarNav,
              isOwner,
              menuItems,
              pageLinkBaseUrl,
              queryParams,
              requestedPageScriptHash,
              sidebarChevronDownshift,
              deployedAppMetadata,
              toolbarItems,
            },
            connect: () => {
              sendMessageToHost({
                type: "GUEST_READY",
              })
            },
            onModalReset: () => {
              setForcedModalClose(false)
            },
            onPageChanged: () => {
              setRequestedPageScriptHash(null)
            },
            sendMessage: sendMessageToHost,
          } as HostCommunicationHOC
        }
        {...props}
      />
    )
  }

  ComponentWithHostCommunication.displayName = `withHostCommunication(${
    WrappedComponent.displayName || WrappedComponent.name
  })`

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithHostCommunication, WrappedComponent)
}

export default withHostCommunication
