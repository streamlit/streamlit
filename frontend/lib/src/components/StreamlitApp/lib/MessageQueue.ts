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

import { createNanoEvents } from "nanoevents"
import type { Emitter } from "nanoevents"
import { ForwardMsg, type ForwardMsgMetadata } from "../../../proto"
import { ForwardMsgCache } from "./ForwardMessageCache"
import type { BaseUriParts } from "../../../util/UriUtil"

type ForwardMsgType = Exclude<ForwardMsg["type"], undefined | "refHash">
type ForwardMsgOptions = ForwardMsg[ForwardMsgType]
type ForwardMessageCallback<T> = (
  msg: T,
  metadaata: ForwardMsgMetadata | null | undefined
) => void

type ForwardMsgTypeMap<T> = {
  [K in ForwardMsgType]: ForwardMessageCallback<T>
}

interface Events<T> extends ForwardMsgTypeMap<T> {
  unknown: ForwardMessageCallback<unknown>
  "*": ForwardMessageCallback<ForwardMsg>
}

const DEFAULT_MAX_CACHED_MESSAGE_AGE = 2 // Measured in number of reruns

export class MessageQueue {
  /**
   * This dictionary stores received messages that we haven't sent out yet
   * (because we're still decoding previous messages)
   */
  private messageQueue: ForwardMsg[]

  private pendingMessageQueue: Uint8Array[]

  private forwardMessageCache: ForwardMsgCache | null

  private events: Emitter<Events<ForwardMsgOptions>>

  private maxCachedMessageAge: number

  constructor() {
    this.pendingMessageQueue = []
    this.messageQueue = []
    this.forwardMessageCache = null
    this.events = createNanoEvents<Events<ForwardMsgOptions>>()
    this.maxCachedMessageAge = DEFAULT_MAX_CACHED_MESSAGE_AGE
  }

  on<T>(
    event: keyof Events<T>,
    callback: ForwardMessageCallback<T>
  ): () => void {
    return this.events.on(event, callback)
  }

  emitForwardMessage(forwardMessage: ForwardMsg): void {
    const { type } = forwardMessage
    const metadata = forwardMessage.metadata as ForwardMsgMetadata

    if (type === undefined) {
      this.events.emit("unknown", forwardMessage, metadata)
    } else if (type !== "refHash") {
      // A couple of messages have special information for our cache. Save it here.
      if (type === "newSession") {
        this.maxCachedMessageAge =
          forwardMessage.newSession?.config?.maxCachedMessageAge ?? 0
      }

      if (type === "scriptFinished") {
        this.forwardMessageCache?.incrementRunCount(this.maxCachedMessageAge)
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Protobuf does not make this easy
      this.events.emit(type, forwardMessage[type], metadata)
    }

    this.events.emit("*", forwardMessage, metadata)
  }

  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- TODO I don't think it's a big deal
  async setUri(uri: BaseUriParts): Promise<void[]> {
    this.forwardMessageCache = new ForwardMsgCache(uri)

    const pendingQueue: Promise<void>[] = []
    for (const msg of this.pendingMessageQueue) {
      // We intentionally do not await on these calls cause it will handle it on its own.
      pendingQueue.push(this.queueMessage(msg))
    }

    this.pendingMessageQueue = []

    return Promise.all(pendingQueue)
  }

  async queueMessage(msg: Uint8Array): Promise<void> {
    if (!this.forwardMessageCache) {
      this.pendingMessageQueue.push(msg)
      return
    }

    const forwardMsg = ForwardMsg.decode(msg)
    this.messageQueue.push(forwardMsg)

    await this.forwardMessageCache.processMessagePayload(forwardMsg, msg)

    // PerformanceEvents.record({ name: "GotCachedPayload", messageIndex });
    // Dispatch any pending messages in the queue. This may *not* result
    // in our just-decoded message being dispatched: if there are other
    // messages that were received earlier than this one but are being
    // downloaded, our message won't be sent until they're done.
    while (this.messageQueue.length > 0) {
      // TODO Implementation of MessageQueue was weird and insisted on parallel challenges
      // Figure out why cause this might just be easiest.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- length check above ensures shift is safe
      const forwardMessage = this.messageQueue.shift()!
      this.emitForwardMessage(forwardMessage)
      // PerformanceEvents.record({
      //   name: "DispatchedMessage",
      //   messageIndex: dispatchMessageIndex,
      //   messageType: forwardMessage.type,
      // });
    }
  }
}
