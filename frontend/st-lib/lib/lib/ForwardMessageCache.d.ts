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
import { ForwardMsg } from "src/autogen/proto";
import { BaseUriParts } from "src/lib/UriUtil";
/**
 * Handles ForwardMsg caching for WebsocketConnection.
 */
export declare class ForwardMsgCache {
    private readonly messages;
    /**
     * A function that returns our server's base URI, or undefined
     * if we're not connected.
     */
    private readonly getServerUri;
    /**
     * A counter that tracks the number of times the underlying script
     * has been run. We use this to expire our cache entries.
     */
    private scriptRunCount;
    constructor(getServerUri: () => BaseUriParts | undefined);
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
    incrementRunCount(maxMessageAge: number): void;
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
    processMessagePayload(msg: ForwardMsg, encodedMsg: Uint8Array): Promise<ForwardMsg>;
    /**
     * Fetches a message from the server by its hash. This happens when
     * we have a ForwardMsg cache miss - that is, when the server sends
     * us a ForwardMsg reference, and we don't have it in our local
     * cache. This should happen rarely, as the client and server's
     * caches should generally be in sync.
     */
    private fetchMessagePayload;
    /**
     * Add a new message to the cache if appropriate.
     */
    private maybeCacheMessage;
    /**
     * Return a new copy of the ForwardMsg with the given hash
     * from the cache, or undefined if no such message exists.
     *
     * If the message's entry exists, its scriptRunCount will be
     * updated to the current value.
     */
    private getCachedMessage;
}
