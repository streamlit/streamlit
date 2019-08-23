/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import {
  IS_DEV_ENV,
  IS_SHARED_REPORT,
} from './baseconsts'
import { SessionInfo } from 'lib/SessionInfo'
import { logAlways } from './log'


/**
 * The analytics is the Segment.io object. It comes from index.html.
 */
declare const analytics: any


/**
 * A mapping of [delta type] -> [count] which is used to upload delta stats
 * when the app is idle.
 */
interface DeltaCounter {
  [name: string]: number;
}


type Event = [string, object];


type SendFunction = (
  evName: string,
  evData: object,
) => void


export class MetricsManager {
  private initialized: boolean = false

  /**
   * Whether to send metrics to the server.
   */
  private actuallySendMetrics: boolean = false

  /**
   * Queue of metrics events that were enqueued before this MetricsManager was
   * initialized.
   */
  private pendingEvents: Event[] = []

  /**
   * Object used to count the number of delta types seen in a given report.
   * Maps type of delta (string) to count (number).
   */
  private pendingDeltaCounter: DeltaCounter = {}

  /**
   * Singleton MetricsManager object. The reason we're using a singleton here
   * instead of just exporting a module-level instance is so we can easily
   * override it in tests.
   */
  public static current: MetricsManager = new MetricsManager()

  public initialize({gatherUsageStats}: {gatherUsageStats: boolean}): void {
    this.initialized = true
    this.actuallySendMetrics = gatherUsageStats

    if (this.actuallySendMetrics || IS_SHARED_REPORT) {
      this.identify(SessionInfo.current.installationId, {
        'authoremail': SessionInfo.current.authorEmail,
      })
      this.sendPendingEvents()
    }

    logAlways('Gather usage stats: ', this.actuallySendMetrics)
  }

  public enqueue(evName: string, evData: object = {}): void {
    if (!this.initialized) {
      this.pendingEvents.push([evName, evData])
      return
    }

    if (!this.actuallySendMetrics) {
      return
    }

    this.send(evName, evData)
  }

  public clearDeltaCounter(): void {
    this.pendingDeltaCounter = {}
  }

  public incrementDeltaCounter(deltaType: string): void {
    if (this.pendingDeltaCounter[deltaType] == null) {
      this.pendingDeltaCounter[deltaType] = 1
    } else {
      this.pendingDeltaCounter[deltaType]++
    }
  }

  public getDeltaCounter(): DeltaCounter {
    const deltaCounter = this.pendingDeltaCounter
    this.pendingDeltaCounter = {}
    return deltaCounter
  }

  private send(evName: string, evData: object = {}): void {
    const data = {
      ...evData,
      dev: IS_DEV_ENV,
      source: 'browser',
      streamlitVersion: SessionInfo.current.streamlitVersion,
    }

    // Don't actually track events when in dev mode, just print them instead.
    // This is just to keep us from tracking too many events and having to pay
    // for all of them.
    if (IS_DEV_ENV) {
      logAlways('[Dev mode] Not tracking stat datapoint: ', evName, data)
    } else {
      this.track(evName, data)
    }
  }

  private sendPendingEvents(): void {
    this.pendingEvents.forEach(([evName, evData]) => {
      this.send(evName, evData)
    })
    this.pendingEvents = []
  }

  // Wrap analytics methods for mocking:

  private identify(id: string, data: object): void {
    analytics.identify(id, data)
  }

  private track(evName: string, data: object): void {
    analytics.track(evName, data)
  }
}
