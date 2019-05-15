/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import {Signal} from 'typed-signals';
import {SessionEvent} from 'autogen/protobuf';

/** Redispatches SessionEvent messages received from the server. */
export class SessionEventDispatcher {
  /** Dispatched when a SessionEvent is received */
  public readonly onSessionEvent = new Signal<(evt: SessionEvent) => void>();

  /** Redispatches a ForwardMsg.SessionEvent via a signal. */
  public handleSessionEventMsg(msg: SessionEvent): void {
    this.onSessionEvent.emit(msg);
  }
}
