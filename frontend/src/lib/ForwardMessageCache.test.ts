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

import { ForwardMsg } from "src/autogen/proto"
import fetchMock from "fetch-mock"
import { ForwardMsgCache } from "src/lib/ForwardMessageCache"
import { buildHttpUri } from "src/lib/UriUtil"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

interface MockCache {
  cache: ForwardMsgCache
  getCachedMessage: (hash: string) => ForwardMsg | undefined
}

function createCache(): MockCache {
  const cache = new ForwardMsgCache(() => MOCK_SERVER_URI)

  const getCachedMessage = (hash: string): ForwardMsg | undefined =>
    // @ts-ignore accessing into internals for testing
    cache.getCachedMessage(hash, false)

  return { cache, getCachedMessage }
}

/**
 * Create a mock ForwardMsg with the given hash
 */
function createForwardMsg(hash: string, cacheable = true): ForwardMsg {
  return ForwardMsg.fromObject({
    hash,
    metadata: { cacheable, deltaId: 0 },
  })
}

/**
 * Create a mock reference ForwardMsg
 */
function createRefMsg(msg: ForwardMsg): ForwardMsg {
  return ForwardMsg.fromObject({
    hash: "reference",
    metadata: msg.metadata,
    refHash: msg.hash,
  })
}

/**
 * Configure fetch-mock to respond to /message requests for the given
 * ForwardMsg with a valid payload.
 */
function mockGetMessageResponse(msg: ForwardMsg): void {
  const response = {
    status: 200,
    headers: { "Content-Type": "application/octet-stream" },
    body: ForwardMsg.encode(msg).finish(),
  }

  const options = {
    query: { hash: msg.hash },
    method: "get",
  }

  fetchMock.mock(buildHttpUri(MOCK_SERVER_URI, "message"), response, options)
}

/**
 * Configure fetch-mock to respond to /message requests for the given
 * ForwardMsg with a 404.
 */
function mockMissingMessageResponse(msg: ForwardMsg): void {
  const response = { status: 404 }
  const options = {
    query: { hash: msg.hash },
    method: "get",
  }

  fetchMock.mock(buildHttpUri(MOCK_SERVER_URI, "message"), response, options)
}

beforeEach(() => {
  fetchMock.config.sendAsJson = false
})
afterEach(() => fetchMock.restore())

test("caches messages correctly", async () => {
  const { cache, getCachedMessage } = createCache()

  // Cacheable messages should be cached
  const msg1 = createForwardMsg("Cacheable", true)
  const encodedMsg1 = ForwardMsg.encode(msg1).finish()
  await cache.processMessagePayload(msg1, encodedMsg1)
  expect(getCachedMessage("Cacheable")).toEqual(msg1)

  // Uncacheable ones shouldn't!
  const msg2 = createForwardMsg("Uncacheable", false)
  const encodedMsg2 = ForwardMsg.encode(msg2).finish()
  await cache.processMessagePayload(msg2, encodedMsg2)
  expect(getCachedMessage("Uncacheable")).toBeUndefined()

  // Ref messages should never be cached
  const msg3 = createForwardMsg("Cacheable", true)
  if (msg3.metadata) {
    msg3.metadata.deltaPath = [2]
  }
  const ref = createRefMsg(msg3)
  const encodedRefMsg = ForwardMsg.encode(ref).finish()
  const unreferenced = await cache.processMessagePayload(ref, encodedRefMsg)
  expect(getCachedMessage(ref.hash)).toBeUndefined()
  expect(unreferenced).toEqual(msg3)

  // Test that our uncached messages are copies
  expect(unreferenced).not.toBe(msg3)
})

test("caches messages as a deep copy", async () => {
  const { cache, getCachedMessage } = createCache()

  const msg = ForwardMsg.fromObject({
    hash: "Cacheable",
    delta: { newElement: { text: { body: "test" } } },
    metadata: { cacheable: true, deltaPath: [2] },
  })

  const encodedMsg = ForwardMsg.encode(msg).finish()

  await cache.processMessagePayload(msg, encodedMsg)

  // Check if message is correctly cached
  expect(getCachedMessage("Cacheable")).toEqual(msg)

  // Modify specific values inside the message structure:
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  msg.delta!.newElement!.text.body = "foo"
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  msg.metadata!.deltaPath = [10]

  // Check that it does not impact the cached message
  expect(getCachedMessage("Cacheable")?.delta?.newElement?.text.body).toEqual(
    "test"
  )
  expect(getCachedMessage("Cacheable")?.metadata?.deltaPath).toEqual([2])
  // It should not be equal to the changed message
  expect(getCachedMessage("Cacheable")).not.toEqual(msg)
})

test("fetches uncached messages from server", async () => {
  const msg = createForwardMsg("Cacheable", true)
  const refMsg = createRefMsg(msg)
  const encodedRefMsg = ForwardMsg.encode(refMsg).finish()

  // Mock response: /message?hash=Cacheable -> msg
  mockGetMessageResponse(msg)

  const { cache, getCachedMessage } = createCache()

  // processMessagePayload on a reference message whose
  // original version does *not* exist in our local cache. We
  // should hit the server's /message endpoint to fetch it.
  await expect(
    cache.processMessagePayload(refMsg, encodedRefMsg)
  ).resolves.toEqual(msg)

  // The fetched message should now be cached
  expect(getCachedMessage("Cacheable")).toEqual(msg)
})

test("errors when uncached message is not on server", async () => {
  const msg = createForwardMsg("Cacheable", true)
  const refMsg = createRefMsg(msg)
  const encodedRefMsg = ForwardMsg.encode(refMsg).finish()

  // Mock response: /message?hash=Cacheable -> 404
  mockMissingMessageResponse(msg)

  const { cache } = createCache()
  await expect(
    cache.processMessagePayload(refMsg, encodedRefMsg)
  ).rejects.toThrow()
})

test("removes expired messages", () => {
  const { cache, getCachedMessage } = createCache()
  const msg = createForwardMsg("Cacheable", true)
  const encodedMsg = ForwardMsg.encode(msg).finish()

  // Add the message to the cache
  // @ts-ignore accessing into internals for testing
  cache.maybeCacheMessage(msg, encodedMsg)
  expect(getCachedMessage(msg.hash)).toEqual(msg)

  // Increment our age. Our message should still exist.
  cache.incrementRunCount(1)
  expect(getCachedMessage(msg.hash)).toEqual(msg)

  // Bump our age over the expiration threshold.
  cache.incrementRunCount(1)
  expect(getCachedMessage(msg.hash)).toBeUndefined()
})
