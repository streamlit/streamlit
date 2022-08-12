import { logMessage } from "src/lib/log"
import { getRerunAnalysis } from "src/lib/profiler/RerunAnalyzer"
import { ScriptRunState } from "src/lib/ScriptRunState"

interface PerformanceEventBase {
  timestamp?: number
}

export interface RequestedRerunEvent extends PerformanceEventBase {
  name: "RequestedRerun"
  scriptRunState: ScriptRunState
}

export interface BeginHandleMessageEvent extends PerformanceEventBase {
  name: "BeginHandleMessage"
  messageIndex: number
}

export interface DecodedMessageEvent extends PerformanceEventBase {
  name: "DecodedMessage"
  messageIndex: number
  messageType?: string
  len: number
}

export interface GotCachedPayloadEvent extends PerformanceEventBase {
  name: "GotCachedPayload"
  messageIndex: number
}

export interface DispatchedMessageEvent extends PerformanceEventBase {
  name: "DispatchedMessage"
  messageIndex: number
  messageType?: string
}

export type HandleMessageEvent =
  | BeginHandleMessageEvent
  | DecodedMessageEvent
  | GotCachedPayloadEvent
  | DispatchedMessageEvent

export type PerformanceEvent = RequestedRerunEvent | HandleMessageEvent

/** Simple utility for capturing time samples. */
export class PerformanceEvents {
  /** Set this to true to capture PerformanceEvents. */
  public static enabled = false

  private static events: PerformanceEvent[] = []

  public static record(event: PerformanceEvent): void {
    if (!this.enabled) {
      return
    }

    event.timestamp = performance.now()
    this.events.push(event)

    if (
      event.name === "DispatchedMessage" &&
      event.messageType === "scriptFinished"
    ) {
      logMessage("Rerun results", getRerunAnalysis(this.events))
      this.events = []
    }
  }
}
