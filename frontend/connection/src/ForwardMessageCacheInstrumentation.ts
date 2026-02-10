/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { IS_DEV_ENV } from "./constants"

/**
 * Development-only cache instrumentation counters.
 */
export interface ForwardMsgCacheStats {
  cacheRefHits: number
  cacheRefMisses: number
  cachedMessages: number
  payloadIdentityReused: number
}

/**
 * Encapsulates instrumentation counters for `ForwardMsgCache`.
 */
export class ForwardMsgCacheInstrumentation {
  private readonly enabled: boolean

  private readonly stats: ForwardMsgCacheStats = {
    cacheRefHits: 0,
    cacheRefMisses: 0,
    cachedMessages: 0,
    payloadIdentityReused: 0,
  }

  /**
   * @param enabled Whether instrumentation should be active.
   */
  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  /**
   * Record a successful reference-hash cache lookup.
   */
  public recordCacheRefHit(): void {
    if (!this.enabled) {
      return
    }
    this.stats.cacheRefHits += 1
  }

  /**
   * Record a failed reference-hash cache lookup.
   */
  public recordCacheRefMiss(): void {
    if (!this.enabled) {
      return
    }
    this.stats.cacheRefMisses += 1
  }

  /**
   * Record insertion of a newly cached canonical payload.
   */
  public recordCachedMessage(): void {
    if (!this.enabled) {
      return
    }
    this.stats.cachedMessages += 1
  }

  /**
   * Record that a cached payload identity was reused by a `refHash` message.
   */
  public recordPayloadIdentityReused(): void {
    if (!this.enabled) {
      return
    }
    this.stats.payloadIdentityReused += 1
  }

  /**
   * Return instrumentation counters.
   *
   * When instrumentation is disabled, all counters remain at zero.
   */
  public getStats(): Readonly<ForwardMsgCacheStats> {
    return { ...this.stats }
  }
}

/**
 * Build cache instrumentation with production-safe defaults.
 *
 * @param explicitEnable Optional override used mainly by tests.
 */
export function createForwardMsgCacheInstrumentation(
  explicitEnable?: boolean
): ForwardMsgCacheInstrumentation {
  return new ForwardMsgCacheInstrumentation(explicitEnable ?? IS_DEV_ENV)
}
