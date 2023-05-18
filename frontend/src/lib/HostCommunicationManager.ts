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

import { ICustomThemeConfig, WidgetStates } from "src/lib/proto"

import {
  IAllowedMessageOriginsResponse,
  IGuestToHostMessage,
  IHostToGuestMessage,
  VersionedMessage,
  IMenuItem,
  IToolbarItem,
  DeployedAppMetadata,
} from "src/lib/hocs/withHostCommunication/types"
import { isValidOrigin } from "src/lib/util/UriUtil"
import Resolver from "src/lib/util/Resolver"

export const HOST_COMM_VERSION = 1

interface Props {
  theme: {
    setImportedTheme: (themeInfo: ICustomThemeConfig) => void
  }
  sendRerunBackMsg: (
    widgetStates?: WidgetStates,
    pageScriptHash?: string
  ) => void
  closeModal: () => void
  stopScript: () => void
  rerunScript: () => void
  clearCache: () => void
}

interface ConnectionState {
  allowedOrigins: string[]
  deployedAppMetadata: DeployedAppMetadata
  deferredAuthToken: Resolver<string | undefined>
  hideSidebarNav: boolean
  isOwner: boolean
  menuItems: IMenuItem[]
  pageLinkBaseUrl: string
  queryParams: string
  sidebarChevronDownshift: number
  toolbarItems: IToolbarItem[]
}

/**
 * Manages host communication & messaging
 */
export class HostCommunicationManager {
  private props: Props
  public state: ConnectionState

  constructor(props: Props) {
    this.props = props

    this.state = {
      allowedOrigins: [],
      deferredAuthToken: new Resolver(),
      deployedAppMetadata: {},
      hideSidebarNav: false,
      isOwner: false,
      menuItems: [],
      pageLinkBaseUrl: "",
      queryParams: "",
      sidebarChevronDownshift: 0,
      toolbarItems: [],
    }

    // Bind methods for state access - TODO: Remove unnecessary bind functions
    this.setAllowedOriginsResp = this.setAllowedOriginsResp.bind(this)
    this.openHostCommunication = this.openHostCommunication.bind(this)
    this.closeHostCommunication = this.closeHostCommunication.bind(this)
    this.resetAuthToken = this.resetAuthToken.bind(this)
    this.receiveHostMessage = this.receiveHostMessage.bind(this)
    this.sendMessageToHost = this.sendMessageToHost.bind(this)
  }

  /**
   * Adds a listener for messages from the host
   * sends message that guest is ready to receive messages
   */
  public openHostCommunication(): void {
    window.addEventListener("message", this.receiveHostMessage)
    this.sendMessageToHost({ type: "GUEST_READY" })
  }

  /**
   * Cleans up message event listener
   */
  public closeHostCommunication(): void {
    window.removeEventListener("message", this.receiveHostMessage)
  }

  /**
   * Function to reset deferredAuthToken once the resource waiting on the token
   * (that is, the WebsocketConnection singleton) has successfully received it.
   *
   * This should be called in a .then() handler attached to deferredAuthToken.promise.
   */
  public resetAuthToken(): void {
    this.state.deferredAuthToken = new Resolver()
  }

  /**
   * Function to set the response body received from hitting the Streamlit
   * server's /st-allowed-message-origins endpoint. The response contains
   *   - allowedOrigins: A list of origins that we're allowed to receive
   *     cross-iframe messages from via the browser's window.postMessage API.
   *   - useExternalAuthToken: Whether to wait until we've received a
   *     SET_AUTH_TOKEN message before resolving deferredAuthToken.promise. The
   *     WebsocketConnection class waits for this promise to resolve before
   *     attempting to establish a connection with the Streamlit server.
   */
  public setAllowedOriginsResp(resp: IAllowedMessageOriginsResponse): void {
    const { allowedOrigins, useExternalAuthToken } = resp
    if (!useExternalAuthToken) {
      this.state.deferredAuthToken.resolve(undefined)
    }
    if (!allowedOrigins.length) {
      return
    }
    this.state.allowedOrigins = allowedOrigins

    this.openHostCommunication()
  }

  /**
   * Register a function to deliver a message to the Host
   */
  public sendMessageToHost(message: IGuestToHostMessage): void {
    console.log("Sending message to host:", message.type)
    console.log("CURRENT STATE:", this.state)

    window.parent.postMessage(
      {
        stCommVersion: HOST_COMM_VERSION,
        ...message,
      } as VersionedMessage<IGuestToHostMessage>,
      "*"
    )
  }

  /**
   * Register a function to handle a message from the Host
   */
  public receiveHostMessage(event: MessageEvent): void {
    const message: VersionedMessage<IHostToGuestMessage> | any = event.data

    console.log("Received message from host:", message.type)

    // Messages coming from the parent frame of a deployed Streamlit app
    // may not be coming from a trusted source (even if we've set the CSP
    // frame-anscestors header, it doesn't hurt to be extra safe). We avoid
    // processing messages received from origins we haven't explicitly
    // labeled as trusted here to lower the probability that we end up
    // processing malicious input.

    if (
      message.stCommVersion !== HOST_COMM_VERSION ||
      !this.state.allowedOrigins.find(allowed =>
        isValidOrigin(allowed, event.origin)
      )
    ) {
      return
    }

    if (message.type === "CLOSE_MODAL") {
      this.props.closeModal()
    }
    if (message.type === "STOP_SCRIPT") {
      this.props.stopScript()
    }
    if (message.type === "RERUN_SCRIPT") {
      this.props.rerunScript()
    }
    if (message.type === "CLEAR_CACHE") {
      this.props.clearCache()
    }
    if (message.type === "REQUEST_PAGE_CHANGE") {
      this.props.sendRerunBackMsg(undefined, message.pageScriptHash)
    }
    if (message.type === "SET_AUTH_TOKEN") {
      // NOTE: The edge case (that should technically never happen) where
      // useExternalAuthToken is false but we still receive this message
      // type isn't an issue here because resolving a promise a second time
      // is a no-op, and we already resolved the promise to undefined
      // above.
      this.state.deferredAuthToken.resolve(message.authToken)
    }
    if (message.type === "SET_IS_OWNER") {
      this.state.isOwner = message.isOwner
    }
    if (message.type === "SET_MENU_ITEMS") {
      this.state.menuItems = message.items
    }

    if (message.type === "SET_METADATA") {
      this.state.deployedAppMetadata = message.metadata
    }

    if (message.type === "SET_PAGE_LINK_BASE_URL") {
      this.state.pageLinkBaseUrl = message.pageLinkBaseUrl
    }

    if (message.type === "SET_SIDEBAR_CHEVRON_DOWNSHIFT") {
      this.state.sidebarChevronDownshift = message.sidebarChevronDownshift
    }

    if (message.type === "SET_SIDEBAR_NAV_VISIBILITY") {
      this.state.hideSidebarNav = message.hidden
    }

    if (message.type === "SET_TOOLBAR_ITEMS") {
      this.state.toolbarItems = message.items
    }

    if (message.type === "UPDATE_FROM_QUERY_PARAMS") {
      this.state.queryParams = message.queryParams
      this.props.sendRerunBackMsg()
    }

    if (message.type === "UPDATE_HASH") {
      window.location.hash = message.hash
    }
    if (message.type === "SET_CUSTOM_THEME_CONFIG") {
      this.props.theme.setImportedTheme(message.themeInfo)
    }
  }
}
