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

import { getLogger } from "loglevel"

import { ForwardMsg } from "@streamlit/protobuf"
import { isNullOrUndefined, notNullOrUndefined } from "@streamlit/utils"

const LOG = getLogger("ForwardMessageCache")

class CacheEntry {
  public readonly encodedMsg: Uint8Array

  public readonly fragmentId?: string

  public scriptRunCount = 0

  public getAge(curScriptRunCount: number): number {
    return curScriptRunCount - this.scriptRunCount
  }

  constructor(
    encodedMsg: Uint8Array,
    scriptRunCount: number,
    fragmentId?: string
  ) {
    this.encodedMsg = encodedMsg
    this.scriptRunCount = scriptRunCount
    this.fragmentId = fragmentId
  }
}

/**
 * Handles ForwardMsg caching for WebsocketConnection.
 */
export class ForwardMsgCache {
  private readonly messages = new Map<string, CacheEntry>()

  /**
   * A counter that tracks the number of times the underlying script
   * has been run. We use this to expire our cache entries.
   */
  private scriptRunCount = 0

  /**
   * Increment our scriptRunCount, and remove all entries from the cache
   * that have expired. This should be called after the script has finished
   * running.
   *
   * @param maxMessageAge Max age of a message in the cache.
   * The "age" of a message is defined by how many times the underlying script
   * has finished running (without a compile error) since the message was
   * last accessed.
   *
   * @param fragmentIdsThisRun The fragment IDs being run in this rerun.
   */
  public incrementRunCount(
    maxMessageAge: number,
    fragmentIdsThisRun: string[]
  ): void {
    // We only have a single `scriptRunCount` regardless of if its a fragment or full rerun.
    // Thereby, if we have a couple of subsequent fragment runs, the `scriptRunCount`
    // will increase, but we only remove cached messages if they are part of the provided
    // fragment IDs. However, for messages not related to the fragment the
    // maxMessageAge will not work as expected anymore. If they are not part of the
    // next full rerun after a couple of fragment runs, they will be deleted.
    // We could improve this by having a different `scriptRunCount` for each cache message.
    // But the technical overhead might not be worth it for what we can gain.
    this.scriptRunCount += 1

    // It is safe to delete from a map during forEach iteration:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach#Description
    this.messages.forEach((entry, hash) => {
      if (
        fragmentIdsThisRun.length > 0 &&
        (!entry.fragmentId || !fragmentIdsThisRun.includes(entry.fragmentId))
      ) {
        // We only want to delete messages related to the current fragment ID.
        return
      }

      if (entry.getAge(this.scriptRunCount) > maxMessageAge) {
        LOG.info(`Removing expired ForwardMsg [hash=${hash}]`)
        this.messages.delete(hash)
      }
    })
  }

  /**
   * Return a list of all the hashes of messages currently in the cache.
   */
  public getCachedMessageHashes(): string[] {
    return Array.from(this.messages.keys())
  }

  /**
   * Process a ForwardMsg, "de-referencing" it if it's a reference to
   * a cached message.
   *
   * - If the message is cacheable, store it in the cache and return it
   *   unmodified.
   * - If the message is instead a reference to another message, look for
   *   the referenced message in the cache, and return it.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async processMessagePayload(
    msg: ForwardMsg,
    encodedMsg: Uint8Array
  ): Promise<ForwardMsg> {
    this.maybeCacheMessage(msg, encodedMsg)

    if (msg.type !== "refHash") {
      return msg
    }

    const newMsg = this.getCachedMessage(msg.refHash as string, true)
    if (notNullOrUndefined(newMsg)) {
      LOG.info(`Cached ForwardMsg HIT [hash=${msg.refHash}]`)
    } else {
      throw new Error(
        `Cached ForwardMsg MISS [hash=${msg.refHash}]. This is not expected to happen. Please [report this bug](https://github.com/streamlit/streamlit/issues).`
      )
    }

    // Copy the metadata from the refMsg into our new message
    if (!msg.metadata) {
      throw new Error(
        "Reference ForwardMsg has no metadata. This is not expected to happen. Please [report this bug](https://github.com/streamlit/streamlit/issues)."
      )
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

    if (!msg.metadata?.cacheable) {
      // Don't cache messages that the server hasn't marked as cacheable.
      return
    }

    if (!msg.hash) {
      // We don't cache message if the hash is not set. However, this
      // should never happen, so we log an error and return.
      LOG.error(
        "ForwardMsg has no hash. This is not expected to happen, please report this bug.",
        msg
      )
      return
    }

    if (this.getCachedMessage(msg.hash, true) !== undefined) {
      // We've already cached this message; don't need to do
      // anything more. (Using getCachedMessage() here ensures
      // that the message's scriptRunCount value gets updated as
      // expected.)
      return
    }

    LOG.info(`Caching ForwardMsg [hash=${msg.hash}]`)
    this.messages.set(
      msg.hash,

      new CacheEntry(
        encodedMsg,
        this.scriptRunCount,
        // Only delta messages have an associated fragment ID:
        msg.delta?.fragmentId ?? undefined
      )
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
    if (isNullOrUndefined(cached)) {
      return undefined
    }

    if (updateScriptRunCount) {
      cached.scriptRunCount = this.scriptRunCount
    }
    return ForwardMsg.decode(cached.encodedMsg)
  }
}
