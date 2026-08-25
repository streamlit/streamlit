/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { getLogger } from "loglevel"

import { ICustomThemeConfig, WidgetStates } from "@streamlit/protobuf"

import { PresetThemeName } from "~lib/theme/types"
import { isValidOrigin } from "~lib/util/UriUtil"

import {
  AppConfig,
  DeployedAppMetadata,
  GuestToHostEnvelope,
  IGuestToHostMessage,
  IHostToGuestMessage,
  IMenuItem,
  IToolbarItem,
  VersionedMessage,
} from "./types"

const LOG = getLogger("HostCommunicationManager")

export const HOST_COMM_VERSION = 1

/**
 * Marks a same-window copy of a guest→host message so the guest does not
 * handle it as a host command. Some types (notably `UPDATE_HASH`) are valid
 * in both directions. Host platforms can import this from `@streamlit/lib`
 * to filter echoes without hardcoding the string.
 */
export const IS_GUEST_TO_HOST_ECHO = "isGuestToHostEcho"

/**
 * True when this payload is our same-window guest→host echo, not an inbound
 * host command. Requires an own property whose value is boolean `true`, so
 * inherited or truthy values cannot suppress host commands.
 *
 * Uses `Object.prototype.hasOwnProperty` rather than `Object.hasOwn` so this
 * message-routing path does not throw in browsers that lack that ES2022
 * built-in (it is not in `frontend/utils/src/polyfills`).
 */
function isGuestToHostEchoPayload(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    Object.prototype.hasOwnProperty.call(data, IS_GUEST_TO_HOST_ECHO) &&
    (data as Record<string, unknown>)[IS_GUEST_TO_HOST_ECHO] === true
  )
}

interface HostCommunicationProps {
  readonly streamlitExecutionStartedAt: number
  readonly sendRerunBackMsg: (
    widgetStates?: WidgetStates,
    pageScriptHash?: string
  ) => void
  readonly closeModal: () => void
  readonly stopScript: () => void
  readonly rerunScript: () => void
  readonly clearCache: () => void
  readonly sendAppHeartbeat: (ackTimeoutMilliseconds: number) => void
  readonly setInputsDisabled: (inputsDisabled: boolean) => void
  readonly themeChanged: (
    themeName?: PresetThemeName,
    themeInfo?: ICustomThemeConfig
  ) => void
  readonly pageChanged: (pageScriptHash: string) => void
  readonly isOwnerChanged: (isOwner: boolean) => void
  readonly fileUploadClientConfigChanged: (payload: {
    prefix: string
    headers: Record<string, string>
  }) => void
  readonly hostMenuItemsChanged: (menuItems: IMenuItem[]) => void
  readonly hostToolbarItemsChanged: (toolbarItems: IToolbarItem[]) => void
  readonly hostHideSidebarNavChanged: (hideSidebarNav: boolean) => void
  readonly sidebarChevronDownshiftChanged: (
    sidebarChevronDownshift: number
  ) => void
  readonly pageLinkBaseUrlChanged: (pageLinkBaseUrl: string) => void
  readonly queryParamsChanged: (queryParams: string) => void
  readonly deployedAppMetadataChanged: (
    deployedAppMetadata: DeployedAppMetadata
  ) => void
  readonly restartWebsocketConnection: () => void
  readonly terminateWebsocketConnection: () => void
  readonly printApp: () => void
}

/**
 * Manages host communication & messaging
 */
export default class HostCommunicationManager {
  private readonly props: HostCommunicationProps

  private allowedOrigins: string[]

  private deferredAuthToken: PromiseWithResolvers<string | undefined>

  private isHostCommOpen = false

  constructor(props: HostCommunicationProps) {
    this.props = props

    this.allowedOrigins = []
    this.deferredAuthToken = Promise.withResolvers<string | undefined>()
  }

  /**
   * Adds a listener for messages from the host and sends a GUEST_READY
   * message. This is idempotent: subsequent calls are no-ops while the
   * communication channel is open, ensuring only one listener is registered
   * and only one GUEST_READY is sent per app lifecycle.
   */
  public openHostCommunication = (): void => {
    if (this.isHostCommOpen) {
      return
    }
    this.isHostCommOpen = true
    window.addEventListener("message", this.receiveHostMessage)
    const guestReadyMessage: IGuestToHostMessage = {
      type: "GUEST_READY",
      streamlitExecutionStartedAt: this.props.streamlitExecutionStartedAt,
      guestReadyAt: Date.now(),
    }
    this.sendMessageToHost(guestReadyMessage)
  }

  /**
   * Cleans up message event listener and resets the open flag so
   * communication can be re-established if needed.
   */
  public closeHostCommunication = (): void => {
    window.removeEventListener("message", this.receiveHostMessage)
    this.isHostCommOpen = false
  }

  /**
   * Function to reset deferredAuthToken once the resource waiting on the token
   * (that is, the WebsocketConnection singleton) has successfully received it.
   *
   * This should be called in a .then() handler attached to deferredAuthToken.promise.
   */
  public resetAuthToken = (): void => {
    this.deferredAuthToken = Promise.withResolvers<string | undefined>()
  }

  /**
   * Function returning a promise that resolves to the auth token sent by the host
   * Used by connectionManager
   */
  public claimAuthToken = (): Promise<string | undefined> => {
    return this.deferredAuthToken.promise
  }

  /**
   * Sets the allowed origins configuration.
   */
  public setAllowedOrigins = ({
    allowedOrigins,
    useExternalAuthToken,
  }: AppConfig): void => {
    if (!useExternalAuthToken) {
      this.deferredAuthToken.resolve(undefined)
    }
    if (!allowedOrigins?.length) {
      return
    }
    this.allowedOrigins = allowedOrigins

    this.openHostCommunication()
  }

  /**
   * Deliver a message to a host that is on the same origin as the guest.
   * When the app is embedded, also posts a tagged copy to this window so an
   * in-iframe host can observe it.
   */
  public sendMessageToSameOriginHost = (
    message: IGuestToHostMessage
  ): void => {
    this.postMessageToParentAndEcho(message, window.location.origin)
  }

  /**
   * Deliver a message to the host.
   * When the app is embedded, also posts a tagged copy to this window so an
   * in-iframe host can observe it.
   */
  public sendMessageToHost = (message: IGuestToHostMessage): void => {
    this.postMessageToParentAndEcho(message, "*")
  }

  private buildVersionedMessage(
    message: IGuestToHostMessage
  ): VersionedMessage<IGuestToHostMessage> {
    return {
      stCommVersion: HOST_COMM_VERSION,
      ...message,
    }
  }

  /**
   * Post `message` to `window.parent`. When embedded, also post a tagged copy
   * to this window so an in-iframe host can observe guest messages even if
   * the parent is a third-party page. The copy sets `isGuestToHostEcho: true`
   * so `receiveHostMessage` can ignore it. Posting to `window` already limits
   * delivery to this window's listeners; `window.location.origin` refuses the
   * dispatch if this window has navigated to another origin.
   *
   * Do not echo at top level: `isSelfPost` is false when
   * `window === window.parent`, so an unignored top-level echo could run as a
   * host command (e.g. UPDATE_HASH).
   */
  private postMessageToParentAndEcho(
    message: IGuestToHostMessage,
    parentTargetOrigin: string
  ): void {
    const versionedMessage = this.buildVersionedMessage(message)
    window.parent.postMessage(versionedMessage, parentTargetOrigin)
    if (window !== window.parent) {
      const echo: GuestToHostEnvelope = {
        ...versionedMessage,
        [IS_GUEST_TO_HOST_ECHO]: true,
      }
      window.postMessage(echo, window.location.origin)
    }
  }

  /**
   * Register a function to handle a message from the Host
   */
  public receiveHostMessage = (event: MessageEvent): void => {
    const message = event.data as VersionedMessage<IHostToGuestMessage>

    // Messages coming from the parent frame of a deployed Streamlit app
    // may not be coming from a trusted source (even if we've set the CSP
    // frame-ancestors header, it doesn't hurt to be extra safe). We avoid
    // processing messages received from origins we haven't explicitly
    // labeled as trusted, and only accept trusted postMessage events from the
    // direct parent frame (or a genuine same-window self-post, see below) so
    // same-origin child iframes cannot spoof host commands.
    const isFromParent = event.source === window.parent
    // Genuine same-window self-post used by an in-iframe embed preamble to
    // deliver host messages (e.g. SET_AUTH_TOKEN) to the library when there is
    // no trusted parent frame to relay them (window.parent is a third-party
    // page). The browser sets event.source to the calling window, so this can
    // only match a post from this very window (not a child frame, whose source
    // would be the child's window). Trusting it grants no extra privilege
    // since any script in this same window already has full same-origin access.
    const isSelfPost = event.source === window && window !== window.parent
    // Ignore our own guest→host echo so bidirectional types (e.g. UPDATE_HASH)
    // are not executed as host commands. Require isSelfPost so a parent cannot
    // drop a host command by forging the marker.
    if (isSelfPost && isGuestToHostEchoPayload(event.data)) {
      return
    }
    // Reject script-dispatched (synthetic) events, and only accept messages
    // from the direct parent frame or a genuine same-window self-post.
    const isTrustedMessage = event.isTrusted && (isFromParent || isSelfPost)
    const isHostMessage = message?.stCommVersion === HOST_COMM_VERSION
    // Only parse origins for genuine host messages; this global handler
    // receives many unrelated postMessages and isValidOrigin allocates
    // URL/URLPattern objects on every call.
    const isAllowedOrigin =
      isHostMessage &&
      this.allowedOrigins.some(allowed => isValidOrigin(allowed, event.origin))

    if (!isTrustedMessage || !isHostMessage || !isAllowedOrigin) {
      // Only log when the payload looks like a genuine host message so we don't
      // spam logs for the many unrelated postMessages this global handler
      // receives. This helps diagnose cases where a legitimate host's messages
      // are unexpectedly dropped -- including a dropped same-window self-post
      // from an in-iframe embed preamble (e.g. a SET_AUTH_TOKEN whose origin is
      // not allow-listed), which the earlier blanket self-post skip hid.
      if (isHostMessage) {
        LOG.debug(
          "Ignoring host message: isTrusted=%s, sourceIsParent=%s, selfPost=%s, allowedOrigin=%s, origin=%s",
          event.isTrusted,
          isFromParent,
          isSelfPost,
          isAllowedOrigin,
          event.origin
        )
      }
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
      this.props.pageChanged(message.pageScriptHash)
    }

    if (message.type === "SEND_APP_HEARTBEAT") {
      const timeout = message.ackTimeoutMilliseconds
      const validatedTimeout =
        typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0
          ? timeout
          : 0
      this.props.sendAppHeartbeat(validatedTimeout)
    }

    if (message.type === "SET_INPUTS_DISABLED") {
      this.props.setInputsDisabled(message.disabled)
    }

    if (message.type === "SET_AUTH_TOKEN") {
      // NOTE: The edge case (that should technically never happen) where
      // useExternalAuthToken is false but we still receive this message
      // type isn't an issue here because resolving a promise a second time
      // is a no-op, and we already resolved the promise to undefined
      // above.
      this.deferredAuthToken.resolve(message.authToken)
    }

    if (message.type === "SET_FILE_UPLOAD_CLIENT_CONFIG") {
      const { prefix, headers } = message
      this.props.fileUploadClientConfigChanged({
        prefix,
        headers,
      })
    }

    if (message.type === "SET_IS_OWNER") {
      this.props.isOwnerChanged(message.isOwner)
    }

    if (message.type === "SET_MENU_ITEMS") {
      this.props.hostMenuItemsChanged(message.items)
    }

    if (message.type === "SET_METADATA") {
      this.props.deployedAppMetadataChanged(message.metadata)
    }

    if (message.type === "SET_PAGE_LINK_BASE_URL") {
      this.props.pageLinkBaseUrlChanged(message.pageLinkBaseUrl)
    }

    if (message.type === "SET_SIDEBAR_CHEVRON_DOWNSHIFT") {
      this.props.sidebarChevronDownshiftChanged(
        message.sidebarChevronDownshift
      )
    }

    if (message.type === "SET_SIDEBAR_NAV_VISIBILITY") {
      this.props.hostHideSidebarNavChanged(message.hidden)
    }

    if (message.type === "SET_TOOLBAR_ITEMS") {
      this.props.hostToolbarItemsChanged(message.items)
    }

    if (message.type === "UPDATE_FROM_QUERY_PARAMS") {
      this.props.queryParamsChanged(message.queryParams)
      this.props.sendRerunBackMsg()
    }

    if (message.type === "UPDATE_HASH") {
      window.location.hash = message.hash
    }

    if (message.type === "SET_CUSTOM_THEME_CONFIG") {
      this.props.themeChanged(message.themeName, message.themeInfo)
    }

    if (message.type === "RESTART_WEBSOCKET_CONNECTION") {
      this.props.restartWebsocketConnection()
    }

    if (message.type === "TERMINATE_WEBSOCKET_CONNECTION") {
      this.props.terminateWebsocketConnection()
    }

    if (message.type === "PRINT_APP") {
      this.props.printApp()
    }
  }
}
