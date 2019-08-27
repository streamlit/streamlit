/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Sits atop WebsocketConnection or StaticConnection,
 * and transforms received messages into ForwardMsgs. Handles
 * message caching.
 */

import {ForwardMsg, ForwardMsgMetadata} from 'autogen/proto'
import {logMessage} from 'lib/log'
import {BaseUriParts, buildHttpUri} from 'lib/ServerUtil'

// This value should be equal to the value defined in the server
const CACHED_MESSAGE_SIZE_MIN = 10 * 10e3  // 10k

export class ForwardMsgCache {
  private readonly messages = new Map<string, ForwardMsg>()

  /**
   * A function that returns our server's base URI, or undefined
   * if we're not connected.
   */
  private readonly getServerUri: () => BaseUriParts | undefined;

  public constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  /**
   * Process a ForwardMsg:
   * - If the message is cacheable, store it in the cache and return it.
   * - If the message is instead a reference to another message, look for
   *   the referenced message in the cache, and return it.
   * - If the referenced message isn't in our cache, request it from the
   *   server, cache it, and return it.
   */
  public async processMessage(msg: ForwardMsg): Promise<ForwardMsg> {
    this.maybeCacheMessage(msg)

    if (msg.type !== 'refHash') {
      return msg
    }

    let newMsg = this.getCachedMessage(msg.refHash)
    if (newMsg != null) {
      logMessage(`Cached ForwardMsg HIT [hash=${msg.refHash}]`)
    } else {
      // Cache miss: fetch from the server
      logMessage(`Cached ForwardMsg MISS [hash=${msg.refHash}]`)

      const serverURI = this.getServerUri()
      if (serverURI === undefined) {
        throw new Error(
          'Cannot retrieve uncached message: not connected to a server')
      }

      const url = buildHttpUri(serverURI, `message?hash=${msg.refHash}`)
      const rsp = await fetch(new Request(url, { method: 'GET' }))
      if (!rsp.ok) {
        // `fetch` doesn't reject for bad HTTP statuses, so
        // we explicitly check for that.
        throw new Error(rsp.statusText)
      }

      const data = await rsp.arrayBuffer()
      const arrayBuffer = new Uint8Array(data)
      newMsg = ForwardMsg.decode(arrayBuffer)

      this.maybeCacheMessage(newMsg)
    }

    // Copy the metadata from the refMsg into our new message
    newMsg.metadata = ForwardMsgMetadata.create(msg.metadata)
    return newMsg
  }

  /**
   * Add a new message to the cache if appropriate.
   */
  private maybeCacheMessage(msg: ForwardMsg): void {
    if (msg.type === 'refHash') {
      // We never cache reference messages
      return
    }

    if (this.messages.has(msg.hash)) {
      // Already cached
      return
    }

    if (getMessageSize(msg) >= CACHED_MESSAGE_SIZE_MIN) {
      logMessage(`Caching ForwardMsg [hash=${msg.hash}]`)
      this.messages.set(msg.hash, ForwardMsg.create(msg))
    }
  }

  /**
   * Return a new copy of the ForwardMsg with the given hash
   * from the cache, or undefined if no such message exists.
   */
  private getCachedMessage(hash: string): ForwardMsg | undefined {
    const cached = this.messages.get(hash)
    return cached != null ? ForwardMsg.create(cached) : undefined
  }
}

/**
 * Compute the byte length of a ForwardMsg.
 */
function getMessageSize(msg: ForwardMsg): number {
  return ForwardMsg.encode(msg).finish().byteLength
}
