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

import { ForwardMsg } from "@streamlit/protobuf"

import { ForwardMsgCache } from "./ForwardMessageCache"

interface MockCache {
  cache: ForwardMsgCache
  getCachedMessage: (hash: string) => ForwardMsg | undefined
}

function createCache(): MockCache {
  const cache = new ForwardMsgCache()

  const getCachedMessage = (hash: string): ForwardMsg | undefined =>
    // @ts-expect-error (accessing internals for testing)
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
 * Create a mock ForwardMsg with the given hash and fragment ID
 */
function createForwardMsgWithFragment(
  hash: string,
  fragmentId: string,
  cacheable = true
): ForwardMsg {
  return ForwardMsg.fromObject({
    hash,
    delta: { fragmentId },
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
  msg.delta!.newElement!.text!.body = "foo"
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  msg.metadata!.deltaPath = [10]

  // Check that it does not impact the cached message
  expect(getCachedMessage("Cacheable")?.delta?.newElement?.text?.body).toEqual(
    "test"
  )
  expect(getCachedMessage("Cacheable")?.metadata?.deltaPath).toEqual([2])
  // It should not be equal to the changed message
  expect(getCachedMessage("Cacheable")).not.toEqual(msg)
})

test("throws an error message on cache miss", async () => {
  // Create a reference message to a non-existent cache entry
  const msg = createForwardMsg("non-existent-hash", true)
  const refMsg = createRefMsg(msg)
  const encodedRefMsg = ForwardMsg.encode(refMsg).finish()

  const { cache } = createCache()

  await expect(
    cache.processMessagePayload(refMsg, encodedRefMsg)
  ).rejects.toThrow("Cached ForwardMsg MISS [hash=non-existent-hash]")
})

test("removes expired messages", () => {
  const { cache, getCachedMessage } = createCache()
  const msg = createForwardMsg("Cacheable", true)
  const encodedMsg = ForwardMsg.encode(msg).finish()

  // Add the message to the cache
  // @ts-expect-error accessing into internals for testing
  cache.maybeCacheMessage(msg, encodedMsg)
  expect(getCachedMessage(msg.hash)).toEqual(msg)

  // Increment our age. Our message should still exist.
  cache.incrementRunCount(1, [])
  expect(getCachedMessage(msg.hash)).toEqual(msg)

  // Bump our age over the expiration threshold.
  cache.incrementRunCount(1, [])
  expect(getCachedMessage(msg.hash)).toBeUndefined()
})

test("only expires messages with matching fragment IDs", () => {
  const { cache, getCachedMessage } = createCache()

  // Create messages with different fragment IDs
  const msg1 = createForwardMsgWithFragment("msg1", "fragment-1")
  const msg2 = createForwardMsgWithFragment("msg2", "fragment-2")
  const msg3 = createForwardMsg("msg3") // Message without fragment ID

  const encodedMsg1 = ForwardMsg.encode(msg1).finish()
  const encodedMsg2 = ForwardMsg.encode(msg2).finish()
  const encodedMsg3 = ForwardMsg.encode(msg3).finish()

  // Add messages to the cache
  // @ts-expect-error accessing into internals for testing
  cache.maybeCacheMessage(msg1, encodedMsg1)
  // @ts-expect-error accessing into internals for testing
  cache.maybeCacheMessage(msg2, encodedMsg2)
  // @ts-expect-error accessing into internals for testing
  cache.maybeCacheMessage(msg3, encodedMsg3)

  // Verify all messages are in cache
  expect(getCachedMessage("msg1")).toEqual(msg1)
  expect(getCachedMessage("msg2")).toEqual(msg2)
  expect(getCachedMessage("msg3")).toEqual(msg3)

  // Increment run count with fragment-1 - should only consider msg1 for expiration
  cache.incrementRunCount(1, ["fragment-1"])

  // Non-matching fragment IDs and messages without fragment ID should still be cached
  expect(getCachedMessage("msg1")).toEqual(msg1) // Not expired yet (age = 1)
  expect(getCachedMessage("msg2")).toEqual(msg2) // Not considered for expiration
  expect(getCachedMessage("msg3")).toEqual(msg3) // Not considered for expiration

  // Another increment with fragment-1 - should expire fragment-1 message
  cache.incrementRunCount(1, ["fragment-1"])

  // fragment1 (with fragment-1) should now be expired, others should remain
  expect(getCachedMessage("msg1")).toBeUndefined() // Now expired (age > 1)
  expect(getCachedMessage("msg2")).toEqual(msg2) // Still not considered
  expect(getCachedMessage("msg3")).toEqual(msg3) // Still not considered

  // Now run with no fragment IDs -> all should expire since
  // we only allow an age of 1 after a fragment run (might be optimized at some point)
  cache.incrementRunCount(1, [])

  // Now all messages should be expired
  expect(getCachedMessage("msg2")).toBeUndefined()
  expect(getCachedMessage("msg3")).toBeUndefined()
})

test("throws error when reference message has no metadata", async () => {
  const { cache } = createCache()
  const msg1 = createForwardMsg("msg1")
  const encodedMsg1 = ForwardMsg.encode(msg1).finish()

  // Add message to the cache
  // @ts-expect-error accessing into internals for testing
  cache.maybeCacheMessage(msg1, encodedMsg1)

  // Create a reference message without metadata
  const refMsg = ForwardMsg.fromObject({
    refHash: "msg1",
    // Deliberately missing metadata
  })
  const encodedRefMsg = ForwardMsg.encode(refMsg).finish()

  // Should throw an error
  await expect(
    cache.processMessagePayload(refMsg, encodedRefMsg)
  ).rejects.toThrow("Reference ForwardMsg has no metadata")
})
