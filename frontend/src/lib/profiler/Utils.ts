import {
  HandleMessageEvent,
  PerformanceEvent,
} from "src/lib/profiler/PerformanceEvents"

export type EventPredicate = (event: PerformanceEvent) => boolean

export function findNextEventIndex(
  events: PerformanceEvent[],
  startEvent: PerformanceEvent | number,
  pred: EventPredicate
): number | undefined {
  const startIndex =
    typeof startEvent === "number" ? startEvent : events.indexOf(startEvent)

  for (let ii = startIndex; ii < events.length; ++ii) {
    if (pred(events[ii])) {
      return ii
    }
  }

  return undefined
}

export function findNextEvent(
  events: PerformanceEvent[],
  startEvent: PerformanceEvent | number,
  pred: EventPredicate
): PerformanceEvent | undefined {
  const index = findNextEventIndex(events, startEvent, pred)
  return index !== undefined ? events[index] : undefined
}

export function findPrevEventIndex(
  events: PerformanceEvent[],
  startEvent: PerformanceEvent | number,
  pred: EventPredicate
): number | undefined {
  const startIndex =
    typeof startEvent === "number" ? startEvent : events.indexOf(startEvent)

  for (let ii = startIndex; ii >= 0; --ii) {
    const event = events[ii]
    if (pred(event)) {
      return ii
    }
  }

  return undefined
}

export function findPrevEvent(
  events: PerformanceEvent[],
  startEvent: PerformanceEvent | number,
  pred: EventPredicate
): PerformanceEvent | undefined {
  const index = findPrevEventIndex(events, startEvent, pred)
  return index !== undefined ? events[index] : undefined
}

export function isHandleMessageEvent(
  event: PerformanceEvent
): event is HandleMessageEvent {
  return (event as HandleMessageEvent).messageIndex !== undefined
}

/** Return the elapsed time between two performance events. */
export function getTimeDelta(
  a: PerformanceEvent,
  b: PerformanceEvent
): number {
  return Math.abs((b.timestamp as number) - (a.timestamp as number))
}
