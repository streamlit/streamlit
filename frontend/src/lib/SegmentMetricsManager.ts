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

import { pick } from "lodash"
import { SessionInfo } from "src/lib/SessionInfo"
import { initializeSegment } from "src/vendor/Segment"
import { DeployedAppMetadata } from "src/hocs/withHostCommunication/types"
import { IS_DEV_ENV } from "./baseconsts"
import { logAlways } from "./log"
import {
  CustomComponentCounter,
  DeltaCounter,
  MetricsManager,
} from "./MetricsManager"

/**
 * The analytics is the Segment.io object. It is initialized in Segment.ts
 * It is loaded with global scope (window.analytics) to integrate with the segment.io api
 * @global
 * */
declare const analytics: any

type Event = [string, Record<string, unknown>]

export class SegmentMetricsManager implements MetricsManager {
  /** The app's SessionInfo instance. */
  private readonly sessionInfo: SessionInfo

  private initialized = false

  /**
   * Whether to send metrics to the server.
   */
  private actuallySendMetrics = false

  /**
   * Queue of metrics events that were enqueued before this MetricsManager was
   * initialized.
   */
  private pendingEvents: Event[] = []

  /**
   * Object used to count the number of delta types seen in a given script run.
   * Maps type of delta (string) to count (number).
   */
  private pendingDeltaCounter: DeltaCounter = {}

  /**
   * Object used to count the number of custom instance names seen in a given
   * script run. Maps type of custom instance name (string) to count (number).
   */
  private pendingCustomComponentCounter: CustomComponentCounter = {}

  /**
   * App hash uniquely identifies "projects" so we can tell
   * how many projects are being created with Streamlit while still keeping
   * possibly-sensitive info like the mainScriptPath outside of our metrics
   * services.
   */
  private appHash = "Not initialized"

  private metadata: DeployedAppMetadata = {}

  public constructor(sessionInfo: SessionInfo) {
    this.sessionInfo = sessionInfo
  }

  public initialize({
    gatherUsageStats,
  }: {
    gatherUsageStats: boolean
  }): void {
    this.initialized = true
    this.actuallySendMetrics = gatherUsageStats

    if (this.actuallySendMetrics) {
      // Segment will not initialize if this is rendered with SSR
      initializeSegment()

      const userTraits: any = {
        ...this.getInstallationData(),
        ...this.getHostTrackingData(),
      }

      // Only record the user's email if they entered a non-empty one.
      if (this.sessionInfo.current.authorEmail !== "") {
        userTraits.authoremail = this.sessionInfo.current.authorEmail
      }

      this.identify(this.sessionInfo.current.installationId, userTraits)
      this.sendPendingEvents()
    }

    logAlways("Gather usage stats: ", this.actuallySendMetrics)
  }

  public enqueue(evName: string, evData: Record<string, any> = {}): void {
    if (!this.initialized || !this.sessionInfo.isSet) {
      this.pendingEvents.push([evName, evData])
      return
    }

    if (!this.actuallySendMetrics) {
      return
    }

    if (this.pendingEvents.length) {
      this.sendPendingEvents()
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

  public getAndResetDeltaCounter(): DeltaCounter {
    const deltaCounter = this.pendingDeltaCounter
    this.clearDeltaCounter()
    return deltaCounter
  }

  public clearCustomComponentCounter(): void {
    this.pendingCustomComponentCounter = {}
  }

  public incrementCustomComponentCounter(customInstanceName: string): void {
    if (this.pendingCustomComponentCounter[customInstanceName] == null) {
      this.pendingCustomComponentCounter[customInstanceName] = 1
    } else {
      this.pendingCustomComponentCounter[customInstanceName]++
    }
  }

  public getAndResetCustomComponentCounter(): CustomComponentCounter {
    const customComponentCounter = this.pendingCustomComponentCounter
    this.clearCustomComponentCounter()
    return customComponentCounter
  }

  // App hash gets set when updateReport happens.
  // This means that it will be attached to most, but not all, metrics events.
  // The viewReport and createReport events are sent before updateReport happens,
  // so they will not include the appHash.
  public setAppHash = (appHash: string): void => {
    this.appHash = appHash
  }

  // The schema of metrics events (including key names and value types) should
  // only be changed when requested by the data team. This is why `reportHash`
  // retains its old name.
  private send(evName: string, evData: Record<string, unknown> = {}): void {
    const data = {
      ...evData,
      ...this.getHostTrackingData(),
      ...this.getInstallationData(),
      reportHash: this.appHash,
      dev: IS_DEV_ENV,
      source: "browser",
      streamlitVersion: this.sessionInfo.current.streamlitVersion,
      isHello: this.sessionInfo.isHello,
    }

    // Don't actually track events when in dev mode, just print them instead.
    // This is just to keep us from tracking too many events and having to pay
    // for all of them.
    if (IS_DEV_ENV) {
      logAlways("[Dev mode] Not tracking stat datapoint: ", evName, data)
    } else {
      this.track(evName, data, {
        context: {
          // Segment automatically attaches the IP address. But we don't use, process,
          // or store IP addresses for our telemetry. To make this more explicit, we
          // are overwriting this here so that it is never even sent to Segment.
          ip: "0.0.0.0",
        },
      })
    }
  }

  private sendPendingEvents(): void {
    this.pendingEvents.forEach(([evName, evData]) => {
      this.send(evName, evData)
    })
    this.pendingEvents = []
  }

  // Wrap analytics methods for mocking:
  // eslint-disable-next-line class-methods-use-this
  private identify(id: string, data: Record<string, unknown>): void {
    if (IS_DEV_ENV) {
      logAlways("[Dev mode] Not sending id: ", id, data)
    } else {
      analytics.identify(id, data)
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private track(
    evName: string,
    data: Record<string, unknown>,
    context: Record<string, unknown>
  ): void {
    analytics.track(evName, data, context)
  }

  // Get the installation IDs from the session
  private getInstallationData(): Record<string, unknown> {
    return {
      machineIdV3: this.sessionInfo.current.installationIdV3,
    }
  }

  public setMetadata(metadata: DeployedAppMetadata): void {
    this.metadata = metadata
  }

  // Use the tracking data injected by the host of the app if included.
  private getHostTrackingData(): DeployedAppMetadata {
    if (this.metadata) {
      return pick(this.metadata, [
        "hostedAt",
        "owner",
        "repo",
        "branch",
        "mainModule",
        "creatorId",
      ])
    }
    return {}
  }
}
