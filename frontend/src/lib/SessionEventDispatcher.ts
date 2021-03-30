/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import { Signal } from "typed-signals"
import { SessionEvent } from "src/autogen/proto"

/** Redispatches SessionEvent messages received from the server. */
export class SessionEventDispatcher {
  /** Dispatched when a SessionEvent is received */
  public readonly onSessionEvent = new Signal<(evt: SessionEvent) => void>()

  /** Redispatches a ForwardMsg.SessionEvent via a signal. */
  public handleSessionEventMsg(msg: SessionEvent): void {
    this.onSessionEvent.emit(msg)
  }
}
