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

import {
  DecodedMessageEvent,
  HandleMessageEvent,
  PerformanceEvent,
  RequestedRerunEvent,
} from "src/lib/profiler/PerformanceEvents"
import {
  findNextEventIndex,
  findPrevEvent,
  findPrevEventIndex,
  getTimeDelta,
  isHandleMessageEvent,
} from "src/lib/profiler/Utils"

type JSON = any

class RerunAnalyzer {
  /** All the events that occurred in this rerun. */
  private readonly rerunEvents: PerformanceEvent[]

  /** The rerun request event that immediately preceded the rerun, if any. */
  private readonly requestedRerun?: RequestedRerunEvent

  public constructor(allEvents: PerformanceEvent[], lastEventIndex: number) {
    const firstEventIndex = findRunStartEventIndex(allEvents, lastEventIndex)
    if (firstEventIndex === undefined) {
      throw new Error("Unable to find run start!")
    }

    this.rerunEvents = allEvents.slice(firstEventIndex, lastEventIndex + 1)
    this.requestedRerun = <RequestedRerunEvent>(
      findPrevEvent(
        allEvents,
        firstEventIndex - 1,
        evt => evt.name === "RequestedRerun"
      )
    )
  }

  public getResults = (): JSON => {
    // Determine which messages were part of the run
    const messageIndexes = new Set<number>()
    this.rerunEvents.forEach(evt => {
      if (isHandleMessageEvent(evt)) {
        messageIndexes.add(evt.messageIndex)
      }
    })

    if (messageIndexes.size === 0) {
      return "No rerun messages found!"
    }

    // Analyze each message in the run
    const sortedMessageIndexes =
      Array.from(messageIndexes).sort(compareNumbers)

    // Get the total duration of the run
    const lastRerunEvent = this.rerunEvents[this.rerunEvents.length - 1]
    const firstRerunEvent = this.rerunEvents[0]

    const results: any = {
      messages: sortedMessageIndexes.map(this.getMessageAnalysis),
      rerunDuration: getTimeDelta(firstRerunEvent, lastRerunEvent),
    }

    // If we had a rerun request, include some additional stats
    if (this.requestedRerun !== undefined) {
      results.requestedRerun = true
      results.scriptRunStateAtStart = this.requestedRerun.scriptRunState
      results.requestToRerunStart = getTimeDelta(
        this.requestedRerun,
        firstRerunEvent
      )
    }

    return results
  }

  private getMessageAnalysis = (messageIndex: number): any => {
    // Get each event associated with the given message.
    const handleMessageEvents: HandleMessageEvent[] = []
    let curIndex = 0
    while (curIndex < this.rerunEvents.length) {
      const nextEventIndex = findNextMessageEvent(
        this.rerunEvents,
        curIndex,
        messageIndex
      )

      if (nextEventIndex === undefined) {
        break
      }

      handleMessageEvents.push(
        <HandleMessageEvent>this.rerunEvents[nextEventIndex]
      )
      curIndex = nextEventIndex + 1
    }

    if (handleMessageEvents.length === 0) {
      throw new Error(`No messages for the given index: ${messageIndex}`)
    }

    const first = handleMessageEvents[0]
    const last = handleMessageEvents[handleMessageEvents.length - 1]

    const messageAnalysis: any = {
      messageIndex,
      duration: getTimeDelta(first, last),
      steps: [],
    }

    for (let ii = 1; ii < handleMessageEvents.length; ++ii) {
      const prevStep = handleMessageEvents[ii - 1]
      const thisStep = handleMessageEvents[ii]

      if (thisStep.name === "DecodedMessage") {
        messageAnalysis.messageType = thisStep.messageType
        messageAnalysis.len = thisStep.len
      }

      messageAnalysis.steps.push({
        name: thisStep.name,
        duration: getTimeDelta(prevStep, thisStep),
      })
    }

    return messageAnalysis
  }
}

function compareNumbers(a: number, b: number): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

/** Find the index of the first event in the run. */
function findRunStartEventIndex(
  events: PerformanceEvent[],
  lastEventIndex: number
): number | undefined {
  const newSessionDecodedIndex = findPrevEventIndex(
    events,
    lastEventIndex - 1,
    event =>
      event.name === "DecodedMessage" && event.messageType === "newSession"
  )

  if (newSessionDecodedIndex === undefined) {
    return undefined
  }

  // Find the newSession's "BeginHandleMessage" event
  const { messageIndex } = <DecodedMessageEvent>events[newSessionDecodedIndex]

  return findPrevEventIndex(
    events,
    newSessionDecodedIndex,
    event =>
      event.name === "BeginHandleMessage" &&
      event.messageIndex === messageIndex
  )
}

/** Find the next HandleMessageEvent index for the given message. */
function findNextMessageEvent(
  events: PerformanceEvent[],
  startIndex: number,
  messageIndex: number
): number | undefined {
  return findNextEventIndex(
    events,
    startIndex,
    evt => isHandleMessageEvent(evt) && evt.messageIndex === messageIndex
  )
}

/** Return a human-readable performance analysis of a single rerun. */
export function getRerunAnalysis(
  allEvents: PerformanceEvent[],
  lastEventIndex?: number
): JSON {
  return new RerunAnalyzer(
    allEvents,
    lastEventIndex ?? allEvents.length - 1
  ).getResults()
}
