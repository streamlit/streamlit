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
import { logMessage } from "src/lib/log"
import { BaseUriParts, buildHttpUri } from "src/lib/UriUtil"
import { ensureError } from "./ErrorHandling"

export const FETCH_MESSAGE_PATH = "_stcore/message"

class CacheEntry {
  public readonly encodedMsg: Uint8Array

  public scriptRunCount = 0

  public getAge(curScriptRunCount: number): number {
    return curScriptRunCount - this.scriptRunCount
  }

  constructor(encodedMsg: Uint8Array, scriptRunCount: number) {
    this.encodedMsg = encodedMsg
    this.scriptRunCount = scriptRunCount
  }
}

/**
 * Handles ForwardMsg caching for WebsocketConnection.
 */
export class ForwardMsgCache {
  private readonly messages = new Map<string, CacheEntry>()

  /**
   * A function that returns our server's base URI, or undefined
   * if we're not connected.
   */
  private readonly getServerUri: () => BaseUriParts | undefined

  /**
   * A counter that tracks the number of times the underlying script
   * has been run. We use this to expire our cache entries.
   */
  private scriptRunCount = 0

  constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  /**
   * Increment our scriptRunCount, and remove all entries from the cache
   * that have expired. This should be called after the script has finished
   * running.
   *
   * @param maxMessageAge Max age of a message in the cache.
   * The "age" of a message is defined by how many times the underlying script
   * has finished running (without a compile error) since the message was
   * last accessed.
   */
  public incrementRunCount(maxMessageAge: number): void {
    this.scriptRunCount += 1

    // It is safe to delete from a map during forEach iteration:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach#Description
    this.messages.forEach((entry, hash) => {
      if (entry.getAge(this.scriptRunCount) > maxMessageAge) {
        logMessage(`Removing expired ForwardMsg [hash=${hash}]`)
        this.messages.delete(hash)
      }
    })
  }

  /**
   * Process a ForwardMsg, "de-referencing" it if it's a reference to
   * a cached message.
   *
   * - If the message is cacheable, store it in the cache and return it
   *   unmodified.
   * - If the message is instead a reference to another message, look for
   *   the referenced message in the cache, and return it.
   * - If the referenced message isn't in our cache, request it from the
   *   server, cache it, and return it.
   */
  public async processMessagePayload(
    msg: ForwardMsg,
    encodedMsg: Uint8Array
  ): Promise<ForwardMsg> {
    this.maybeCacheMessage(msg, encodedMsg)

    if (msg.type !== "refHash") {
      return msg
    }

    let newMsg = this.getCachedMessage(msg.refHash as string, true)
    if (newMsg != null) {
      logMessage(`Cached ForwardMsg HIT [hash=${msg.refHash}]`)
    } else {
      // Cache miss: fetch from the server
      logMessage(`Cached ForwardMsg MISS [hash=${msg.refHash}]`)
      const encodedNewMsg = await this.fetchMessagePayload(
        msg.refHash as string
      )
      try {
        newMsg = ForwardMsg.decode(encodedNewMsg)
      } catch (e) {
        throw new Error(
          `Failed to decode ForwardMsg (hash=${msg.refHash}): ${
            ensureError(e).message
          }`
        )
      }

      this.maybeCacheMessage(newMsg, encodedNewMsg)
    }

    // Copy the metadata from the refMsg into our new message
    if (!msg.metadata) {
      throw new Error("ForwardMsg has no metadata")
    }
    newMsg.metadata = ForwardMsg.decode(encodedMsg).metadata
    return newMsg
  }

  /**
   * Fetches a message from the server by its hash. This happens when
   * we have a ForwardMsg cache miss - that is, when the server sends
   * us a ForwardMsg reference, and we don't have it in our local
   * cache. This should happen rarely, as the client and server's
   * caches should generally be in sync.
   */
  private async fetchMessagePayload(hash: string): Promise<Uint8Array> {
    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error(
        "Cannot retrieve uncached message: not connected to a server"
      )
    }

    const url = buildHttpUri(serverURI, `${FETCH_MESSAGE_PATH}?hash=${hash}`)
    const rsp = await fetch(url)
    if (!rsp.ok) {
      // `fetch` doesn't reject for bad HTTP statuses, so
      // we explicitly check for that.
      throw new Error(
        `Failed to retrieve ForwardMsg (hash=${hash}): ${rsp.statusText}`
      )
    }

    const data = await rsp.arrayBuffer()
    return new Uint8Array(data)
  }

  /**
   * Add a new message to the cache if appropriate.
   */
  private maybeCacheMessage(msg: ForwardMsg, encodedMsg: Uint8Array): void {
    if (msg.type === "refHash") {
      // We never cache reference messages. These messages
      // may have `metadata.cacheable` set, but this is
      // only because they carry the metadata for the messages
      // they refer to.
      return
    }

    if (!msg.metadata || !msg.metadata.cacheable) {
      // Don't cache messages that the server hasn't marked as cacheable.
      return
    }

    if (this.getCachedMessage(msg.hash, true) !== undefined) {
      // We've already cached this message; don't need to do
      // anything more. (Using getCachedMessage() here ensures
      // that the message's scriptRunCount value gets updated as
      // expected.)
      return
    }

    logMessage(`Caching ForwardMsg [hash=${msg.hash}]`)
    this.messages.set(
      msg.hash,
      new CacheEntry(encodedMsg, this.scriptRunCount)
    )
  }

  /**
   * Return a new copy of the ForwardMsg with the given hash
   * from the cache, or undefined if no such message exists.
   *
   * If the message's entry exists, its scriptRunCount will be
   * updated to the current value.
   */
  private getCachedMessage(
    hash: string,
    updateScriptRunCount: boolean
  ): ForwardMsg | undefined {
    const cached = this.messages.get(hash)
    if (cached == null) {
      return undefined
    }

    if (updateScriptRunCount) {
      cached.scriptRunCount = this.scriptRunCount
    }
    return ForwardMsg.decode(cached.encodedMsg)
  }
}
