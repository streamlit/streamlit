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

import Resolver from "src/lib/Resolver"
import { isValidOrigin } from "src/lib/UriUtil"

import {
  IAllowedMessageOriginsResponse,
  IGuestToHostMessage,
  IHostToGuestMessage,
  IMenuItem,
  IToolbarItem,
  VersionedMessage,
  HostCommunicationState,
} from "./types"

export interface HostCommunicationHOC {
  currentState: HostCommunicationState

  /**
   * Callback to be called when the Streamlit app closes a dialog.
   */
  onModalReset: () => void

  onScriptRerun: () => void
  onScriptStop: () => void
  onCacheClear: () => void

  /**
   * Callback to be called when the Streamlit app's page is changed.
   */
  onPageChanged: () => void

  /**
   * Function to reset authTokenPromise once the resource waiting on the token
   * (that is, the WebsocketConnection singleton) has successfully received it.
   *
   * This should be called in a .then() handler attached to authTokenPromise.
   */
  resetAuthToken: () => void

  /**
   * Function to send a message to the app's parent frame via the browser's
   * window.postMessage API.
   */
  sendMessage: (message: IGuestToHostMessage) => void

  /**
   * Function to set the response body received from hitting the Streamlit
   * server's /st-allowed-message-origins endpoint. The response contains
   *   - allowedOrigins: A list of origins that we're allowed to receive
   *     cross-iframe messages from via the browser's window.postMessage API.
   *   - useExternalAuthToken: Whether to wait until we've received a
   *     SET_AUTH_TOKEN message before resolving authTokenPromise. The
   *     WebsocketConnection class waits for this promise to resolve before
   *     attempting to establish a connection with the Streamlit server.
   */
  setAllowedOriginsResp: (resp: IAllowedMessageOriginsResponse) => void
}

export const HOST_COMM_VERSION = 1

function sendMessageToHost(message: IGuestToHostMessage): void {
  window.parent.postMessage(
    {
      stCommVersion: HOST_COMM_VERSION,
      ...message,
    } as VersionedMessage<IGuestToHostMessage>,
    "*"
  )
}

interface InjectedProps {
  hostCommunication: HostCommunicationHOC
}

type WrappedProps<P extends InjectedProps> = Omit<P, "hostCommunication">

function withHostCommunication<P extends InjectedProps>(
  WrappedComponent: ComponentType<P>
): ComponentType<WrappedProps<P>> {
  function ComponentWithHostCommunication(
    props: WrappedProps<P>
  ): ReactElement {
    // TODO(vdonato): Refactor this to use useReducer to make this less
    // unwieldy. We may want to consider installing the redux-toolkit package
    // even if we're not using redux just because it's so useful for reducing
    // this type of boilerplate.
    const [forcedModalClose, setForcedModalClose] = useState(false)
    const [scriptRerunRequested, setScriptRerunRequested] = useState(false)
    const [scriptStopRequested, setScriptStopRequested] = useState(false)
    const [cacheClearRequested, setCacheClearRequested] = useState(false)
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

    const [allowedOriginsResp, setAllowedOriginsResp] =
      useState<IAllowedMessageOriginsResponse | null>(null)
    const [deferredAuthToken, setDeferredAuthToken] = useState<
      Resolver<string | undefined>
    >(() => new Resolver())

    useEffect(() => {
      if (!allowedOriginsResp) {
        return () => {}
      }

      const { allowedOrigins, useExternalAuthToken } = allowedOriginsResp
      if (!useExternalAuthToken) {
        deferredAuthToken.resolve(undefined)
      }

      function receiveMessage(event: MessageEvent): void {
        const message: VersionedMessage<IHostToGuestMessage> | any = event.data

        // Messages coming from the parent frame of a deployed Streamlit app
        // may not be coming from a trusted source (even if we've set the CSP
        // frame-anscestors header, it doesn't hurt to be extra safe). We avoid
        // processing messages received from origins we haven't explicitly
        // labeled as trusted here to lower the probability that we end up
        // processing malicious input.
        if (
          message.stCommVersion !== HOST_COMM_VERSION ||
          !allowedOrigins.find(allowed => isValidOrigin(allowed, event.origin))
        ) {
          return
        }

        if (message.type === "CLOSE_MODAL") {
          setForcedModalClose(true)
        }
        if (message.type === "STOP_SCRIPT") {
          setScriptStopRequested(true)
        }
        if (message.type === "RERUN_SCRIPT") {
          setScriptRerunRequested(true)
        }
        if (message.type === "CLEAR_CACHE") {
          setCacheClearRequested(true)
        }

        if (message.type === "REQUEST_PAGE_CHANGE") {
          setRequestedPageScriptHash(message.pageScriptHash)
        }

        if (message.type === "SET_AUTH_TOKEN") {
          // NOTE: The edge case (that should technically never happen) where
          // useExternalAuthToken is false but we still receive this message
          // type isn't an issue here because resolving a promise a second time
          // is a no-op, and we already resolved the promise to undefined
          // above.
          deferredAuthToken.resolve(message.authToken)
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

      if (!allowedOrigins.length) {
        return () => {}
      }

      window.addEventListener("message", receiveMessage)
      sendMessageToHost({ type: "GUEST_READY" })

      return () => {
        window.removeEventListener("message", receiveMessage)
      }
    }, [allowedOriginsResp])

    return (
      <WrappedComponent
        {...(props as P)}
        hostCommunication={
          {
            currentState: {
              authTokenPromise: deferredAuthToken.promise,
              forcedModalClose,
              scriptRerunRequested,
              scriptStopRequested,
              cacheClearRequested,
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
            resetAuthToken: () => {
              setDeferredAuthToken(new Resolver())
            },
            onModalReset: () => {
              setForcedModalClose(false)
            },
            onScriptRerun: () => {
              setScriptRerunRequested(false)
            },
            onScriptStop: () => {
              setScriptStopRequested(false)
            },
            onCacheClear: () => {
              setCacheClearRequested(false)
            },
            onPageChanged: () => {
              setRequestedPageScriptHash(null)
            },
            sendMessage: sendMessageToHost,
            setAllowedOriginsResp,
          } as HostCommunicationHOC
        }
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
