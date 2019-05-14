/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import {Signal} from 'typed-signals';
import {mapOneOf} from './immutableProto';
import {SessionEvent} from '../autogen/protobuf';

/** Report-related events delivered by the server */
export enum ReportEvent {
  SOURCE_FILE_CHANGED = 'sourceFileChanged',
  MANUALLY_STOPPED = 'manuallyStopped',
}

export class ReportEventDispatcher {
  /** Dispatched when a ReportEvent is received */
  public readonly onReportEvent = new Signal<(evt: ReportEvent) => void>();

  /**
   * Transforms a ForwardMsg.SessionEvent into a ReportEvent, and
   * dispatches the onReportEvent signal
   */
  public handleSessionEventMsg(msg: SessionEvent): void {
    const reportEvent: ReportEvent = mapOneOf(msg, 'type', {
      reportChangedOnDisk: ReportEvent.SOURCE_FILE_CHANGED,
      reportWasManuallyStopped: ReportEvent.MANUALLY_STOPPED,
    });

    this.onReportEvent.emit(reportEvent);
  }
}
