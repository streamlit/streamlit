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

import { mockEndpoints } from "~lib/mocks/mocks"

import { ComponentRegistry } from "./ComponentRegistry"

describe("ComponentRegistry", () => {
  it("Constructs component URLs", () => {
    const endpoint = mockEndpoints()
    const registry = new ComponentRegistry(endpoint)
    const url = registry.getComponentURL("foo", "index.html")
    expect(url).toEqual(endpoint.buildComponentURL("foo", "index.html"))
  })

  it("Constructs bidirectional component URLs", () => {
    const endpoint = mockEndpoints()
    const registry = new ComponentRegistry(endpoint)
    const url = registry.getBidiComponentURL("foo", "bundle.js")
    expect(url).toEqual(endpoint.buildBidiComponentURL("foo", "bundle.js"))
  })

  it("Dispatches messages to listeners", () => {
    const registry = new ComponentRegistry(mockEndpoints())
    // @ts-expect-error
    const { onMessageEvent } = registry

    // Create some mocks
    const msgSource1 = {} as MessageEventSource
    const msgSource2 = {} as MessageEventSource
    const msgListener1 = vi.fn()
    const msgListener2 = vi.fn()

    // This should not error (and will not be handled).
    onMessageEvent(new MessageEvent("message", { source: msgSource1 }))

    // Register a listener for message events from the window.
    registry.registerListener(msgSource1, msgListener1)

    // Send a message to the registry. It should be re-dispatched
    // to our listener.
    const messageData = {
      isStreamlitMessage: true,
      type: "setComponentValue",
    }
    onMessageEvent(
      new MessageEvent("message", { source: msgSource1, data: messageData })
    )
    expect(msgListener1).toHaveBeenCalledWith(messageData.type, messageData)

    // Send a message that's missing data. It should *not* be re-dispatched.
    msgListener1.mockReset()
    onMessageEvent(new MessageEvent("message", { source: msgSource1 }))
    expect(msgListener1).not.toHaveBeenCalled()

    // De-register our listener. Messages should not be re-dispatched.
    msgListener1.mockReset()
    registry.deregisterListener(msgSource1)
    onMessageEvent(
      new MessageEvent("message", { source: msgSource1, data: messageData })
    )
    expect(msgListener1).not.toHaveBeenCalled()

    // Ensure that listeners only receive messages for their own source.
    registry.registerListener(msgSource1, msgListener1)
    registry.registerListener(msgSource2, msgListener2)

    msgListener1.mockReset()
    msgListener2.mockReset()
    onMessageEvent(
      new MessageEvent("message", { source: msgSource1, data: messageData })
    )
    expect(msgListener1).toHaveBeenCalledWith(messageData.type, messageData)
    expect(msgListener2).not.toHaveBeenCalled()

    msgListener1.mockReset()
    msgListener2.mockReset()
    onMessageEvent(
      new MessageEvent("message", { source: msgSource2, data: messageData })
    )
    expect(msgListener1).not.toHaveBeenCalled()
    expect(msgListener2).toHaveBeenCalledWith(messageData.type, messageData)
  })

  it("Sends CLIENT_ERROR when sendTimeoutError is called", () => {
    const registry = new ComponentRegistry(mockEndpoints())
    const sendClientErrorToHostSpy = vi.spyOn(
      // @ts-expect-error - registry.endpoints is private
      registry.endpoints,
      "sendClientErrorToHost"
    )
    const url = registry.getComponentURL("foo", "index.html")
    registry.sendTimeoutError(url, "foo")
    expect(sendClientErrorToHostSpy).toHaveBeenCalledWith(
      "Custom Component",
      "Request Timeout",
      "Your app is having trouble loading the component.",
      url,
      "foo"
    )
  })

  it("Triggers call to endpoint's checkSourceUrlResponse when registry's checkSourceUrlResponse is called", async () => {
    const registry = new ComponentRegistry(mockEndpoints())
    const url = registry.getComponentURL("foo", "index.html")
    const endpointsCheckSourceResponseSpy = vi.spyOn(
      // @ts-expect-error - registry.endpoints is private
      registry.endpoints,
      "checkSourceUrlResponse"
    )
    await registry.checkSourceUrlResponse(url, "foo")
    expect(endpointsCheckSourceResponseSpy).toHaveBeenCalledWith(
      url,
      "Custom Component",
      "foo"
    )
  })

  it("warns when the same MessageEventSource is registered more than once", () => {
    const logger = getLogger("ComponentRegistry")
    const warnSpy = vi.spyOn(logger, "warn")
    const registry = new ComponentRegistry(mockEndpoints())
    const source = {} as MessageEventSource
    registry.registerListener(source, vi.fn())
    expect(warnSpy).not.toHaveBeenCalled()
    registry.registerListener(source, vi.fn())
    expect(warnSpy).toHaveBeenCalledWith(
      "MessageEventSource registered multiple times!",
      source
    )
    warnSpy.mockRestore()
  })

  it("does not warn when deregistering a registered MessageEventSource", () => {
    const logger = getLogger("ComponentRegistry")
    const warnSpy = vi.spyOn(logger, "warn")
    const registry = new ComponentRegistry(mockEndpoints())
    const source = {} as MessageEventSource
    registry.registerListener(source, vi.fn())
    registry.deregisterListener(source)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("warns when deregistering a MessageEventSource that was not registered", () => {
    const logger = getLogger("ComponentRegistry")
    const warnSpy = vi.spyOn(logger, "warn")
    const registry = new ComponentRegistry(mockEndpoints())
    registry.deregisterListener({} as MessageEventSource)
    expect(warnSpy).toHaveBeenCalledWith(
      "Could not deregister unregistered MessageEventSource!"
    )
    warnSpy.mockRestore()
  })

  it("ignores postMessage data that does not own isStreamlitMessage", () => {
    const registry = new ComponentRegistry(mockEndpoints())
    // @ts-expect-error
    const { onMessageEvent } = registry
    const source = {} as MessageEventSource
    const listener = vi.fn()
    registry.registerListener(source, listener)
    onMessageEvent(
      new MessageEvent("message", {
        source,
        data: { other: true },
      })
    )
    expect(listener).not.toHaveBeenCalled()
  })

  it("ignores postMessage data where isStreamlitMessage is only inherited", () => {
    const registry = new ComponentRegistry(mockEndpoints())
    // @ts-expect-error
    const { onMessageEvent } = registry
    const source = {} as MessageEventSource
    const listener = vi.fn()
    registry.registerListener(source, listener)
    const data = Object.create({ isStreamlitMessage: true }) as {
      type: string
    }
    data.type = "setComponentValue"
    onMessageEvent(new MessageEvent("message", { source, data }))
    expect(listener).not.toHaveBeenCalled()
  })

  it("warns and drops component messages with no event source", () => {
    const logger = getLogger("ComponentRegistry")
    const warnSpy = vi.spyOn(logger, "warn")
    const registry = new ComponentRegistry(mockEndpoints())
    // @ts-expect-error
    const { onMessageEvent } = registry
    const data = { isStreamlitMessage: true, type: "setComponentValue" }
    onMessageEvent(new MessageEvent("message", { source: null, data }))
    expect(warnSpy).toHaveBeenCalledWith(
      "Received component message with no eventSource!",
      data
    )
    warnSpy.mockRestore()
  })

  it("warns and drops Streamlit messages that omit type", () => {
    const logger = getLogger("ComponentRegistry")
    const warnSpy = vi.spyOn(logger, "warn")
    const registry = new ComponentRegistry(mockEndpoints())
    // @ts-expect-error
    const { onMessageEvent } = registry
    const source = {} as MessageEventSource
    registry.registerListener(source, vi.fn())
    const data = { isStreamlitMessage: true }
    onMessageEvent(new MessageEvent("message", { source, data }))
    expect(warnSpy).toHaveBeenCalledWith(
      "Received Streamlit message with no type!",
      data
    )
    warnSpy.mockRestore()
  })

  it("warns when the listener map holds a non-function for a source", () => {
    const logger = getLogger("ComponentRegistry")
    const warnSpy = vi.spyOn(logger, "warn")
    const registry = new ComponentRegistry(mockEndpoints())
    const source = {} as MessageEventSource
    registry.registerListener(source, vi.fn())
    const corrupted = registry as unknown as {
      msgListeners: Map<MessageEventSource, unknown>
    }
    corrupted.msgListeners.set(source, "not-a-function")
    // @ts-expect-error
    const { onMessageEvent } = registry
    const data = { isStreamlitMessage: true, type: "setComponentValue" }
    onMessageEvent(new MessageEvent("message", { source, data }))
    expect(warnSpy).toHaveBeenCalledWith(
      "Received component message for unregistered ComponentInstance!",
      data
    )
    warnSpy.mockRestore()
  })
})
