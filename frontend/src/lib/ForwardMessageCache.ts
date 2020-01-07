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

import { ForwardMsg, ForwardMsgMetadata } from "autogen/proto"
import { logMessage } from "lib/log"
import { BaseUriParts, buildHttpUri } from "lib/UriUtil"

class CacheEntry {
  public readonly msg: ForwardMsg
  public reportRunCount = 0

  public getAge(curReportRunCount: number): number {
    return curReportRunCount - this.reportRunCount
  }

  constructor(msg: ForwardMsg, reportRunCount: number) {
    this.msg = msg
    this.reportRunCount = reportRunCount
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
   * A counter that tracks the number of times the underyling report
   * has been run. We use this to expire our cache entries.
   */
  private reportRunCount = 0

  constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  /**
   * Increment our reportRunCount, and remove all entries from the cache
   * that have expired. This should be called after the report has finished
   * running.
   *
   * @param maxMessageAge Max age of a message in the cache.
   * The "age" of a message is defined by how many times the underyling report
   * has finished running (without a compile error) since the message was
   * last accessed.
   */
  public incrementRunCount(maxMessageAge: number): void {
    this.reportRunCount += 1

    // It is safe to delete from a map during forEach iteration:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach#Description
    this.messages.forEach((entry, hash) => {
      if (entry.getAge(this.reportRunCount) > maxMessageAge) {
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
  public async processMessagePayload(msg: ForwardMsg): Promise<ForwardMsg> {
    this.maybeCacheMessage(msg)

    if (msg.type !== "refHash") {
      return msg
    }

    let newMsg = this.getCachedMessage(msg.refHash, true)
    if (newMsg != null) {
      logMessage(`Cached ForwardMsg HIT [hash=${msg.refHash}]`)
    } else {
      // Cache miss: fetch from the server
      logMessage(`Cached ForwardMsg MISS [hash=${msg.refHash}]`)
      newMsg = await this.fetchMessagePayload(msg.refHash)
      this.maybeCacheMessage(newMsg)
    }

    // Copy the metadata from the refMsg into our new message
    if (!msg.metadata) {
      throw new Error("ForwardMsg has no metadata")
    }
    newMsg.metadata = ForwardMsgMetadata.create(msg.metadata)
    return newMsg
  }

  /**
   * Fetches a message from the server by its hash. This happens when
   * we have a ForwardMsg cache miss - that is, when the server sends
   * us a ForwardMsg reference, and we don't have it in our local
   * cache. This should happen rarely, as the client and server's
   * caches should generally be in sync.
   */
  private async fetchMessagePayload(hash: string): Promise<ForwardMsg> {
    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error(
        "Cannot retrieve uncached message: not connected to a server"
      )
    }

    const url = buildHttpUri(serverURI, `message?hash=${hash}`)
    const rsp = await fetch(url)
    if (!rsp.ok) {
      // `fetch` doesn't reject for bad HTTP statuses, so
      // we explicitly check for that.
      throw new Error(
        `Failed to retrieve ForwardMsg (hash=${hash}): ${rsp.statusText}`
      )
    }

    const data = await rsp.arrayBuffer()
    const arrayBuffer = new Uint8Array(data)
    try {
      return ForwardMsg.decode(arrayBuffer)
    } catch (e) {
      throw new Error(
        `Failed to decode ForwardMsg (hash=${hash}): ${e.message}`
      )
    }
  }

  /**
   * Add a new message to the cache if appropriate.
   */
  private maybeCacheMessage(msg: ForwardMsg): void {
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
      // that the message's reportRunCount value gets updated as
      // expected.)
      return
    }

    logMessage(`Caching ForwardMsg [hash=${msg.hash}]`)
    this.messages.set(
      msg.hash,
      new CacheEntry(ForwardMsg.create(msg), this.reportRunCount)
    )
  }

  /**
   * Return a new copy of the ForwardMsg with the given hash
   * from the cache, or undefined if no such message exists.
   *
   * If the message's entry exists, its reportRunCount will be
   * updated to the current value.
   */
  private getCachedMessage(
    hash: string,
    updateReportRunCount: boolean
  ): ForwardMsg | undefined {
    const cached = this.messages.get(hash)
    if (cached == null) {
      return undefined
    }

    if (updateReportRunCount) {
      cached.reportRunCount = this.reportRunCount
    }
    return ForwardMsg.create(cached.msg)
  }
}
