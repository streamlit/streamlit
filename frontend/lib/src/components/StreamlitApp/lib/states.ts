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

import { ConnectionState } from "../stores/ConnectionContext"
import type { ConnectionManager } from "./ConnectionManager"

function assertUnreachable(state: ConnectionState, event: string): never {
  throw new Error(
    `Unsupported state transition.\nState: ${state}\nEvent: ${event}`
  )
}

function discardEvent(state: ConnectionState, event: string): void {
  // eslint-disable-next-line no-console -- TODO Update logging
  console.warn(`Discarding ${event} while in ${state}`)
}

export abstract class State {
  manager: ConnectionManager

  constructor(manager: ConnectionManager) {
    this.manager = manager
  }

  // Events that could trigger state transitions
  initialize(): void {
    assertUnreachable(this.literal, "initialize")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO
  serverPingSucceeded(_resp: any): void {
    assertUnreachable(this.literal, "serverPingSucceeded")
  }

  connectionSucceeded(): void {
    assertUnreachable(this.literal, "connectionSucceeded")
  }

  connectionTimedOut(): void {
    assertUnreachable(this.literal, "connectionTimedOut")
  }

  connectionError(): void {
    assertUnreachable(this.literal, "connectionError")
  }

  connectionClosed(): void {
    assertUnreachable(this.literal, "connectionClosed")
  }

  fatalError(error: string): void {
    this.manager.setConnectionState(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      new DisconnectedForever(this.manager),
      error
    )
  }

  isConnected(): boolean {
    return false
  }

  // Convenience name for external use
  abstract get literal(): ConnectionState
}

export class PingingServer extends State {
  constructor(manager: ConnectionManager) {
    super(manager)

    // We want to perform this before officially setting
    // the state, so we do it on state creation.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO No need to wait
    this.manager.pingServer()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO
  serverPingSucceeded(resp: any): void {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    this.manager.setConnectionState(new Connecting(this.manager), resp)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO No need to wait
    this.manager.connectToWebSocket()
  }

  get literal(): ConnectionState {
    return ConnectionState.PINGING_SERVER
  }
}

export class Initial extends State {
  initialize(): void {
    this.manager.setConnectionState(new PingingServer(this.manager))
  }

  get literal(): ConnectionState {
    return ConnectionState.INITIAL
  }
}

export class Connected extends State {
  connectionError(): void {
    this.manager.setConnectionState(new PingingServer(this.manager))
  }

  connectionClosed(): void {
    this.manager.setConnectionState(new PingingServer(this.manager))
  }

  isConnected(): boolean {
    return true
  }

  get literal(): ConnectionState {
    return ConnectionState.CONNECTED
  }
}

export class Connecting extends State {
  connectionSucceeded(): void {
    this.manager.setConnectionState(new Connected(this.manager))
  }

  connectionTimedOut(): void {
    this.manager.setConnectionState(new PingingServer(this.manager))
  }

  connectionError(): void {
    this.manager.setConnectionState(new PingingServer(this.manager))
  }

  connectionClosed(): void {
    this.manager.setConnectionState(new PingingServer(this.manager))
  }

  get literal(): ConnectionState {
    return ConnectionState.CONNECTING
  }
}

export class DisconnectedForever extends State {
  initialize(): void {
    discardEvent(this.literal, "initialize")
  }

  connectionSucceeded(): void {
    discardEvent(this.literal, "connectionSucceeded")
  }

  connectionTimedOut(): void {
    discardEvent(this.literal, "connectionTimedOut")
  }

  connectionError(): void {
    discardEvent(this.literal, "connectionError")
  }

  connectionClosed(): void {
    discardEvent(this.literal, "connectionClosed")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO
  serverPingSucceeded(_resp: any): void {
    discardEvent(this.literal, "serverPingSucceeded")
  }

  get literal(): ConnectionState {
    return ConnectionState.DISCONNECTED_FOREVER
  }
}
