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

import axios from "axios"
import { ForwardMsg } from "@streamlit/lib/src/proto"
import { LOG } from "./log"
import { ensureError } from "./ErrorHandling"
import {
  type BaseUriParts,
  buildHttpUri,
} from "@streamlit/lib/src/util/UriUtil"

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

const FORWARD_MSG_CACHE_ENDPOINT = "/_stcore/message"

/**
 * Handles ForwardMsg caching for WebsocketConnection.
 */
export class ForwardMsgCache {
  private readonly messages = new Map<string, CacheEntry>()

  private readonly endpoint: BaseUriParts

  /**
   * A counter that tracks the number of times the underlying script
   * has been run. We use this to expire our cache entries.
   */
  private scriptRunCount = 0

  constructor(endpoint: BaseUriParts) {
    this.endpoint = endpoint
  }

  /**
   * Increment our scriptRunCount, and remove all entries from the cache
   * that have expired. This should be called after the script has finished
   * running.
   *
   * @param maxMessageAge - Max age of a message in the cache.
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
        // eslint-disable-next-line testing-library/no-debugging-utils
        LOG.debug(() => `Removing expired ForwardMsg [hash=${hash}]`)
        this.messages.delete(hash)
      }
    })
  }

  async fetchCachedForwardMsg(hash: string): Promise<Uint8Array> {
    const rsp = await axios.request<Uint16Array>({
      url: buildHttpUri(
        this.endpoint,
        `${FORWARD_MSG_CACHE_ENDPOINT}?hash=${hash}`
      ),
      method: "GET",
      responseType: "arraybuffer",
    })

    return new Uint8Array(rsp.data)
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- We check above
    const refHash = msg.refHash!
    let newMsg = this.getCachedMessage(refHash, true)
    if (newMsg) {
      // eslint-disable-next-line testing-library/no-debugging-utils
      LOG.debug(() => `Cached ForwardMsg HIT [hash=${refHash}]`)
    } else {
      // Cache miss: fetch from the server
      // eslint-disable-next-line testing-library/no-debugging-utils
      LOG.debug(() => `Cached ForwardMsg MISS [hash=${refHash}]`)
      const encodedNewMsg = await this.fetchCachedForwardMsg(refHash)
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

    // eslint-disable-next-line testing-library/no-debugging-utils
    LOG.debug(() => `Caching ForwardMsg [hash=${msg.hash}]`)
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
    if (cached === undefined) {
      return undefined
    }

    if (updateScriptRunCount) {
      cached.scriptRunCount = this.scriptRunCount
    }
    return ForwardMsg.decode(cached.encodedMsg)
  }
}
