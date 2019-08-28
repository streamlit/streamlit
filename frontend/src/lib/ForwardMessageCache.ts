/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Handles message caching for WebsocketConnection.
 */

import {ForwardMsg, ForwardMsgMetadata} from 'autogen/proto'
import {logMessage} from 'lib/log'
import {BaseUriParts, buildHttpUri} from 'lib/ServerUtil'

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

    if (msg.type !== 'refHash') {
      return msg
    }

    let newMsg = this.getCachedMessage(msg.refHash)
    if (newMsg != null) {
      logMessage(`Cached ForwardMsg HIT [hash=${msg.refHash}]`)
    } else {
      // Cache miss: fetch from the server
      logMessage(`Cached ForwardMsg MISS [hash=${msg.refHash}]`)
      newMsg = await this.fetchMessagePayload(msg.refHash)
      this.maybeCacheMessage(newMsg)
    }

    // Copy the metadata from the refMsg into our new message
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
        'Cannot retrieve uncached message: not connected to a server')
    }

    const url = buildHttpUri(serverURI, `message?hash=${hash}`)
    const rsp = await fetch(url)
    if (!rsp.ok) {
      // `fetch` doesn't reject for bad HTTP statuses, so
      // we explicitly check for that.
      throw new Error(`Failed to retrieve ForwardMsg (hash=${hash}): ${rsp.statusText}`)
    }

    const data = await rsp.arrayBuffer()
    const arrayBuffer = new Uint8Array(data)
    try {
      return ForwardMsg.decode(arrayBuffer)
    } catch (e) {
      throw new Error(`Failed to decode ForwardMsg (hash=${hash}): ${e.message}`)
    }
  }

  /**
   * Add a new message to the cache if appropriate.
   */
  private maybeCacheMessage(msg: ForwardMsg): void {
    if (msg.type === 'refHash') {
      // We never cache reference messages. These messages
      // may have `metadata.cacheable` set, but this is
      // only because they carry the metadata for the messages
      // they refer to.
      return
    }

    if (!msg.metadata.cacheable || this.messages.has(msg.hash)) {
      // Don't cache messages that the server hasn't marked as
      // cacheable, or that we've already cached.
      return
    }

    logMessage(`Caching ForwardMsg [hash=${msg.hash}]`)
    this.messages.set(msg.hash, ForwardMsg.create(msg))
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
