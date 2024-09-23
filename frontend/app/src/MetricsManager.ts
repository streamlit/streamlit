/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import pick from "lodash/pick"
import { v4 as uuidv4 } from "uuid"

import { initializeSegment } from "@streamlit/app/src/vendor/Segment"
import {
  DeployedAppMetadata,
  getCookie,
  setCookie,
  IS_DEV_ENV,
  localStorageAvailable,
  logAlways,
  SessionInfo,
} from "@streamlit/lib"

const DEFAULT_METRICS_CONFIG = "https://data.streamlit.io/tokens.json"

/**
 * The analytics is the Segment.io object. It is initialized in Segment.ts
 * It is loaded with global scope (window.analytics) to integrate with the segment.io api
 * @global
 * */
declare const analytics: any

type Event = [string, Record<string, unknown>]

/**
 * A mapping of [component instance name] -> [count] which is used to upload
 * custom component stats when the app is idle.
 */
export interface CustomComponentCounter {
  [name: string]: number
}

export class MetricsManager {
  /** The app's SessionInfo instance. */
  private readonly sessionInfo: SessionInfo

  private initialized = false

  /**
   * Whether to send metrics to the server.
   */
  private actuallySendMetrics = false

  /**
   * The URL to which metrics are sent.
   */
  private metricsUrl: string | undefined = undefined

  /**
   * Function to send a message to the host.
   */
  private sendMessageToHost: (message: any) => void = () => {}

  /**
   * The anonymous ID of the user.
   */
  private anonymousId = ""

  /**
   * Queue of metrics events that were enqueued before this MetricsManager was
   * initialized.
   */
  private pendingEvents: Event[] = []

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
    sendMessageToHost,
  }: {
    gatherUsageStats: boolean
    sendMessageToHost: (message: any) => void
  }): void {
    this.initialized = true
    this.actuallySendMetrics = gatherUsageStats
    this.sendMessageToHost = sendMessageToHost
    this.anonymousId = this.getAnonymousId()

    if (this.actuallySendMetrics) {
      // Segment will not initialize if this is rendered with SSR
      initializeSegment()
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

  // App hash gets set when updateReport happens.
  // This means that it will be attached to most, but not all, metrics events.
  // The viewReport and createReport events are sent before updateReport happens,
  // so they will not include the appHash.
  public setAppHash = (appHash: string): void => {
    this.appHash = appHash
  }

  // Set configuration for metrics - provided by host config
  // or fetched from default URL if not provided.
  public setMetricsConfig = (metricsUrl = ""): void => {
    if (metricsUrl) {
      this.metricsUrl = metricsUrl
    } else {
      this.requestDefaultMetricsConfig()
    }
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
      anonymousId: this.anonymousId,
    }

    // Don't actually track events when in dev mode, just print them instead.
    // This is just to keep us from tracking too many events and having to pay
    // for all of them.
    // if (IS_DEV_ENV) {
    //   logAlways("[Dev mode] Not tracking stat datapoint: ", evName, data)
    // } else
    if (this.metricsUrl === "postMessage") {
      this.postMessageEvent(evName, data)
    } else if (this.metricsUrl) {
      this.track(evName, data, {})
    }
  }

  private sendPendingEvents(): void {
    this.pendingEvents.forEach(([evName, evData]) => {
      this.send(evName, evData)
    })
    this.pendingEvents = []
  }

  // eslint-disable-next-line class-methods-use-this
  private track(
    evName: string,
    data: Record<string, unknown>,
    context: Record<string, unknown>
  ): void {
    // Send the event to the metrics URL
  }

  private postMessageEvent(
    evName: string,
    data: Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    // Trigger message to the host
    console.log("== Sending message to host ==")
    console.log({
      evName,
      data,
      context,
    })
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

  /**
   * Fallback for no metrics host configuration
   * Checks if cached in localStorage, otherwise fetches the config
   * from a default URL.
   */
  private async requestDefaultMetricsConfig(): Promise<any> {
    if (localStorageAvailable()) {
      const cachedConfig = localStorage.getItem("stMetricsConfig")
      if (cachedConfig) {
        this.metricsUrl = cachedConfig
      }
    }

    const response = await fetch(DEFAULT_METRICS_CONFIG)
    if (!response.ok) {
      throw new Error(`Failed to fetch metrics config: ${response.status}`)
    } else {
      const jsonResponse = await response.json()
      const metricsUrl = jsonResponse["mapbox-localhost"]
      if (metricsUrl) {
        this.metricsUrl = metricsUrl
        if (localStorageAvailable()) {
          localStorage.setItem("stMetricsConfig", metricsUrl)
        }
      }
    }
  }

  /**
   * Get/Create user's anonymous ID
   * Checks if existing in cookie or localStorage, otherwise generates
   * a new UUID and stores it in both.
   */
  private getAnonymousId(): string {
    const anonymousIdCookie = getCookie("ajs_anonymous_id")
    const anonymousIdLocalStorage = localStorageAvailable()
      ? localStorage.getItem("ajs_anonymous_id")
      : null

    const expiration = new Date()
    expiration.setFullYear(new Date().getFullYear() + 1)

    if (anonymousIdCookie) {
      this.anonymousId = anonymousIdCookie

      localStorage.setItem("ajs_anonymous_id", anonymousIdCookie)
    } else if (anonymousIdLocalStorage) {
      this.anonymousId = anonymousIdLocalStorage

      setCookie("ajs_anonymous_id", anonymousIdLocalStorage, expiration)
    } else {
      this.anonymousId = uuidv4()

      setCookie("ajs_anonymous_id", this.anonymousId, expiration)
      localStorage.setItem("ajs_anonymous_id", this.anonymousId)
    }

    return this.anonymousId
  }
}
