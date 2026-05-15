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

import {
  BackendOperationRequest,
  BackendOperationResponse,
} from "@streamlit/protobuf"

import { BackendOperationClient } from "./BackendOperationClient"

function createClient(
  sendRequest = vi.fn(),
  getSessionId = () => "session-id"
): BackendOperationClient {
  return new BackendOperationClient({
    sendRequest,
    getSessionId,
  })
}

describe("BackendOperationClient", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("sends deferred file requests with request and session IDs", async () => {
    const sendRequest = vi.fn()
    const client = createClient(sendRequest)

    const promise = client.requestDeferredFile("file-id")

    expect(sendRequest).toHaveBeenCalledTimes(1)
    const request = sendRequest.mock.calls[0][0] as BackendOperationRequest
    expect(request.requestId).toBeTruthy()
    expect(request.sessionId).toBe("session-id")
    expect(request.deferredFile?.fileId).toBe("file-id")
    expect(client.pendingCount).toBe(1)

    client.onResponse(
      new BackendOperationResponse({
        requestId: request.requestId,
        deferredFile: { url: "/media/generated" },
      })
    )

    await expect(promise).resolves.toEqual({ url: "/media/generated" })
    expect(client.pendingCount).toBe(0)
  })

  it("rejects the pending promise when the response contains an error", async () => {
    const sendRequest = vi.fn()
    const client = createClient(sendRequest)

    const promise = client.requestDeferredFile("file-id")
    const request = sendRequest.mock.calls[0][0] as BackendOperationRequest

    client.onResponse(
      new BackendOperationResponse({
        requestId: request.requestId,
        errorMsg: "download failed",
      })
    )

    await expect(promise).rejects.toThrow("download failed")
    expect(client.pendingCount).toBe(0)
  })

  it("rejects timed out requests", async () => {
    vi.useFakeTimers()
    const client = createClient()

    const promise = client.requestDeferredFile("file-id", 1000)

    expect(client.pendingCount).toBe(1)
    vi.advanceTimersByTime(1000)

    await expect(promise).rejects.toThrow("Request timed out")
    expect(client.pendingCount).toBe(0)
  })

  it("rejects pending requests during cleanup", async () => {
    const client = createClient()

    const promise = client.requestDeferredFile("file-id")

    client.cleanup()

    await expect(promise).rejects.toThrow("Connection closed")
    expect(client.pendingCount).toBe(0)
  })

  it("does not throw when receiving a response for an unknown request", () => {
    const client = createClient()

    expect(() => {
      client.onResponse(
        new BackendOperationResponse({
          requestId: "unknown-request",
          deferredFile: { url: "/media/generated" },
        })
      )
    }).not.toThrow()
  })

  it("rejects and removes the request when sending fails", async () => {
    const error = new Error("send failed")
    const sendRequest = vi.fn().mockImplementation(() => {
      throw error
    })
    const client = createClient(sendRequest)

    await expect(client.requestDeferredFile("file-id")).rejects.toBe(error)
    expect(client.pendingCount).toBe(0)
  })

  it("rejects immediately when getSessionId throws", async () => {
    const error = new Error("session not initialized")
    const client = new BackendOperationClient({
      sendRequest: vi.fn(),
      getSessionId: () => {
        throw error
      },
    })

    await expect(client.requestDeferredFile("file-id")).rejects.toBe(error)
    expect(client.pendingCount).toBe(0)
  })

  it("rejects when response has no recognized payload", async () => {
    const sendRequest = vi.fn()
    const client = createClient(sendRequest)

    const promise = client.requestDeferredFile("file-id")
    const request = sendRequest.mock.calls[0][0] as BackendOperationRequest

    // Send a response with no payload fields set
    client.onResponse(
      new BackendOperationResponse({
        requestId: request.requestId,
        // No deferredFile or errorMsg set
      })
    )

    await expect(promise).rejects.toThrow(
      "Response contained no recognized payload"
    )
    expect(client.pendingCount).toBe(0)
  })
})
