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
  S4ACommunicationState,
} from "./types"

export interface S4ACommunicationHOC {
  currentState: S4ACommunicationState
  connect: () => void
  sendMessage: (message: IGuestToHostMessage) => void
  onModalReset: () => void
  onPageChanged: () => void
}

export const S4A_COMM_VERSION = 1

export function sendS4AMessage(message: IGuestToHostMessage): void {
  window.parent.postMessage(
    {
      stCommVersion: S4A_COMM_VERSION,
      ...message,
    } as VersionedMessage<IGuestToHostMessage>,
    "*"
  )
}

function withS4ACommunication(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  function ComponentWithS4ACommunication(props: any): ReactElement {
    // TODO(vdonato): Refactor this to use useReducer to make this less
    // unwieldy.
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
    const [streamlitShareMetadata, setStreamlitShareMetadata] = useState({})
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
          message.stCommVersion !== S4A_COMM_VERSION ||
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

        if (message.type === "SET_IS_OWNER") {
          setIsOwner(message.isOwner)
        }

        if (message.type === "SET_MENU_ITEMS") {
          setMenuItems(message.items)
        }

        if (message.type === "SET_METADATA") {
          setStreamlitShareMetadata(message.metadata)
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
        s4aCommunication={
          {
            currentState: {
              forcedModalClose,
              hideSidebarNav,
              isOwner,
              menuItems,
              pageLinkBaseUrl,
              queryParams,
              requestedPageScriptHash,
              sidebarChevronDownshift,
              streamlitShareMetadata,
              toolbarItems,
            },
            connect: () => {
              sendS4AMessage({
                type: "GUEST_READY",
              })
            },
            onModalReset: () => {
              setForcedModalClose(false)
            },
            onPageChanged: () => {
              setRequestedPageScriptHash(null)
            },
            sendMessage: sendS4AMessage,
          } as S4ACommunicationHOC
        }
        {...props}
      />
    )
  }

  ComponentWithS4ACommunication.displayName = `withS4ACommunication(${WrappedComponent.displayName ||
    WrappedComponent.name})`

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithS4ACommunication, WrappedComponent)
}

export default withS4ACommunication
