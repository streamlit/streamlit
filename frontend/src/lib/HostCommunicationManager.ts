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

import { ICustomThemeConfig } from "src/lib/proto"

import {
  IAllowedMessageOriginsResponse,
  IGuestToHostMessage,
  IHostToGuestMessage,
  VersionedMessage,
} from "src/lib/hocs/withHostCommunication/types"
import { isValidOrigin } from "src/lib/util/UriUtil"
import Resolver from "src/lib/util/Resolver"
import { Dictionary } from "apache-arrow"

export const HOST_COMM_VERSION = 1

interface Props {
  theme: {
    setImportedTheme: (themeInfo: ICustomThemeConfig) => void
  }
  closeModal: () => void
  stopScript: () => void
  rerunScript: () => void
  clearCache: () => void
}

// interface ConnectionState {
//     allowedOrigins: string[]
//     useExternalAuthToken: boolean | null
//     deferredAuthToken: Resolver<string | undefined>
// }

/**
 * Manages host communication & messaging
 */
export class HostCommunicationManager {
  private props: Props
  private allowedOrigins: string[]
  private useExternalAuthToken: boolean | null
  private deferredAuthToken: Resolver<string | undefined>

  constructor(props: Props) {
    this.props = props
    this.allowedOrigins = []
    this.useExternalAuthToken = null
    this.deferredAuthToken = new Resolver()
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
   * Function to set the response body received from hitting the Streamlit
   * server's /st-allowed-message-origins endpoint. The response contains
   *   - allowedOrigins: A list of origins that we're allowed to receive
   *     cross-iframe messages from via the browser's window.postMessage API.
   *   - useExternalAuthToken: Whether to wait until we've received a
   *     SET_AUTH_TOKEN message before resolving authTokenPromise. The
   *     WebsocketConnection class waits for this promise to resolve before
   *     attempting to establish a connection with the Streamlit server.
   */
  public setAllowedOriginsResp(resp: IAllowedMessageOriginsResponse): void {
    const { allowedOrigins, useExternalAuthToken } = resp
    if (!useExternalAuthToken) {
      this.deferredAuthToken.resolve(undefined)
    }
    if (!allowedOrigins.length) {
      return
    }
    this.allowedOrigins = allowedOrigins
    this.useExternalAuthToken = useExternalAuthToken

    this.openHostCommunication()
  }

  /**
   * Register a function to deliver a message to the Host
   */
  public sendMessageToHost(message: IGuestToHostMessage): void {
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

    if (
      message.stCommVersion !== HOST_COMM_VERSION ||
      !this.allowedOrigins.find(allowed =>
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
  }
}
