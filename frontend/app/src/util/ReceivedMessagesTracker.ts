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

import type { ReceivedMessageSize } from "@streamlit/connection"
import type { ForwardMsg } from "@streamlit/protobuf"

/** Totals reported as MetricsEvent.received_messages. */
interface ReceivedMessagesTotals {
  bytes: number
  messages: number
  cachedMessages: number
  cachedBytes: number
}

/**
 * Counts the ForwardMsgs received for the current script run, for its
 * pageProfile metrics event.
 *
 * Every run starts with a NewSession message, and a run's other messages
 * arrive after it, so the counts restart at each NewSession. Read them when
 * the run's PageProfile message arrives: they then cover the run's messages
 * from its NewSession through its PageProfile. Messages after that, until the
 * next NewSession, aren't reported for any run.
 */
export class ReceivedMessagesTracker {
  private totals: ReceivedMessagesTotals = emptyTotals()

  /**
   * Count a message as it's handled. Messages are counted in the order the
   * server sent them, after references to cached messages are resolved.
   */
  public recordMessage(msg: ForwardMsg, size?: ReceivedMessageSize): void {
    if (msg.type === "newSession") {
      this.totals = emptyTotals()
    }

    this.totals.messages += 1
    this.totals.bytes += size?.byteLength ?? 0
    if (size?.cachedByteLength !== undefined) {
      this.totals.cachedMessages += 1
      this.totals.cachedBytes += size.cachedByteLength
    }
  }

  /** The current run's totals so far. */
  public getRunTotals(): ReceivedMessagesTotals {
    return { ...this.totals }
  }
}

function emptyTotals(): ReceivedMessagesTotals {
  return { bytes: 0, messages: 0, cachedMessages: 0, cachedBytes: 0 }
}
