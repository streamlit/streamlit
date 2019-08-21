/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Sits atop WebsocketConnection or StaticConnection,
 * and transforms received messages into ForwardMsgs. Handles
 * message caching.
 */

import {ForwardMsg} from 'autogen/proto'
import {logMessage} from 'lib/log'

// This value should be equal to the value defined in the server
const CACHED_MESSAGE_SIZE_MIN = 10 * 10e3  // 10k

export class ForwardMsgCache {
  private readonly messages = new Map<string, ForwardMsg>()

  /**
   * Process a ForwardMsg:
   * - If the message is cacheable, store it in the cache and return it.
   * - If the message is instead a reference to another message, retrieve
   * the referenced message from the cache, and re-request it from the server
   * if it's missing from the cache. The referenced message will be
   * returned.
   */
  public async processMessage(msg: ForwardMsg): Promise<ForwardMsg> {
    this.maybeCacheMessage(msg)

    if (msg.type !== 'idReference') {
      return msg
    }

    const cached = this.messages.get(msg.idReference)
    if (cached != null) {
      logMessage(`Cached ForwardMsg HIT [id=${msg.idReference}]`)
      return cached
    }

    // Cache miss: fetch from the server
    logMessage(`Cached ForwardMsg MISS [id=${msg.idReference}]`)

    const rsp = await fetch(`/message?id=${msg.idReference}`)
    const data = await rsp.arrayBuffer()
    msg = ForwardMsg.decode(new Uint8Array(data))
    this.maybeCacheMessage(msg)

    return msg
  }

  private maybeCacheMessage(msg: ForwardMsg): void {
    if (msg.type === 'idReference') {
      // We never cache reference messages
      return
    }

    if (this.messages.has(msg.id)) {
      // Already cached
      return
    }

    if (getMessageSize(msg) >= CACHED_MESSAGE_SIZE_MIN) {
      logMessage(`Caching ForwardMsg [id=${msg.id}]`)
      this.messages.set(msg.id, msg)
    }
  }
}

/**
 * Compute the byte length of a ForwardMsg.
 */
function getMessageSize(msg: ForwardMsg): number {
  return ForwardMsg.encode(msg).finish().byteLength
}
