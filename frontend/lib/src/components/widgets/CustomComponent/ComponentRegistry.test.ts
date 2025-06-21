/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { mockEndpoints } from "~lib/mocks/mocks"

import { ComponentRegistry } from "./ComponentRegistry"

describe("ComponentRegistry", () => {
  test("Constructs component URLs", () => {
    const endpoint = mockEndpoints()
    const registry = new ComponentRegistry(endpoint)
    const url = registry.getComponentURL("foo", "index.html")
    expect(url).toEqual(endpoint.buildComponentURL("foo", "index.html"))
  })

  test("Dispatches messages to listeners", () => {
    const registry = new ComponentRegistry(mockEndpoints())
    // @ts-expect-error
    const { onMessageEvent } = registry

    // Create some mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    const msgSource1: any = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    const msgSource2: any = {}
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

  test("Sends CLIENT_ERROR when sendTimeoutError is called", () => {
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

  test("Triggers call to endpoint's checkSourceUrlResponse when registry's checkSourceUrlResponse is called", async () => {
    const registry = new ComponentRegistry(mockEndpoints())
    const url = registry.getComponentURL("foo", "index.html")
    const registryCheckSourceResponseSpy = vi.spyOn(
      registry,
      "checkSourceUrlResponse"
    )
    const endpointsCheckSourceResponseSpy = vi.spyOn(
      // @ts-expect-error - registry.endpoints is private
      registry.endpoints,
      "checkSourceUrlResponse"
    )
    await registry.checkSourceUrlResponse(url, "foo")
    expect(registryCheckSourceResponseSpy).toHaveBeenCalledWith(url, "foo")
    expect(endpointsCheckSourceResponseSpy).toHaveBeenCalledWith(
      url,
      "Custom Component",
      "foo"
    )
  })
})
