/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import { logWarning } from "lib/log"
import { BaseUriParts, buildHttpUri } from "lib/UriUtil"
import { ComponentInstance } from "./ComponentInstance"

/**
 * Dispatches iframe messages to ComponentInstances.
 */
export class ComponentRegistry {
  private readonly getServerUri: () => BaseUriParts | undefined
  private readonly instances = new Map<MessageEventSource, ComponentInstance>()

  public constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
    window.addEventListener("message", this.onMessageEvent)
  }

  public registerComponentInstance = (
    messageEventSource: MessageEventSource,
    instance: ComponentInstance
  ): void => {
    if (this.instances.has(messageEventSource)) {
      logWarning(`ComponentInstance registered multiple times!`, instance)
    }

    this.instances.set(messageEventSource, instance)
  }

  public deregisterComponentInstance = (
    messageEventSource: MessageEventSource
  ): void => {
    const removed = this.instances.delete(messageEventSource)
    if (!removed) {
      logWarning(`Could not deregister unregistered ComponentInstance!`)
    }
  }

  public getComponentURL = (componentId: string, path: string): string => {
    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error("Can't fetch component: not connected to a server")
    }

    return buildHttpUri(serverURI, `component/${componentId}/${path}`)
  }

  private onMessageEvent = (event: MessageEvent): void => {
    if (!event.data.hasOwnProperty("isStreamlitMessage")) {
      // Disregard messages that don't come from components.
      return
    }

    if (event.source == null) {
      // This should not be possible.
      logWarning(`Received component message with no eventSource!`, event.data)
      return
    }

    // Get the ComponentInstance associated with the event
    const instance = this.instances.get(event.source)
    if (instance == null) {
      logWarning(
        `Received component message for unregistered ComponentInstance!`,
        event.data
      )
      return
    }

    const type = event.data["type"]
    if (type == null) {
      logWarning(`Received Streamlit message with no type!`, event.data)
      return
    }

    // Forward the message on to the appropriate ComponentInstance.
    instance.onBackMsg(type, event.data)
  }
}
