/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import { getLogger } from "loglevel"
import { v4 as uuidv4 } from "uuid"

import { IS_DEV_ENV } from "@streamlit/connection"
import {
  DeployedAppMetadata,
  IGuestToHostMessage,
  SessionInfo,
  setCookie,
} from "@streamlit/lib"
import { IMetricsEvent, MetricsEvent } from "@streamlit/protobuf"
import { getCookie, localStorageAvailable } from "@streamlit/utils"

// Default metrics config fetched when none provided by host config endpoint
export const DEFAULT_METRICS_CONFIG = "https://data.streamlit.io/metrics.json"
const LOG = getLogger("MetricsManager")

type EventName = "viewReport" | "updateReport" | "pageProfile" | "menuClick"
type Event = [EventName, Partial<IMetricsEvent>]

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
   * Function to send a message to the host via postMessage communication
   */
  private sendMessageToHost: (message: IGuestToHostMessage) => void = () => {}

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

  public async initialize({
    gatherUsageStats,
    sendMessageToHost,
  }: {
    gatherUsageStats: boolean
    sendMessageToHost: (message: IGuestToHostMessage) => void
  }): Promise<void> {
    this.sendMessageToHost = sendMessageToHost
    // Handle if the user or the host has disabled metrics
    this.actuallySendMetrics = gatherUsageStats && this.metricsUrl !== "off"
    this.getAnonymousId()

    // Trigger fallback to fetch default metrics config if not provided by host
    if (this.actuallySendMetrics && !this.metricsUrl) {
      await this.requestDefaultMetricsConfig()

      // If metricsUrl still undefined, deactivate metrics
      if (!this.metricsUrl) {
        LOG.error("Undefined metrics config - deactivating metrics tracking.")
        this.actuallySendMetrics = false
      }
    }

    if (this.actuallySendMetrics) {
      this.sendPendingEvents()
    }

    LOG.info("Gather usage stats: ", this.actuallySendMetrics)
    this.initialized = true
  }

  public enqueue(
    evName: EventName,
    evData: Partial<IMetricsEvent> = {}
  ): void {
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

  // Set metrics url if sent by the host_config
  public setMetricsConfig = (metricsUrl = ""): void => {
    this.metricsUrl = metricsUrl
  }

  public setMetadata(metadata: DeployedAppMetadata): void {
    this.metadata = metadata
  }

  // Fallback - Checks if cached in localStorage, otherwise fetches the config from a default URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  private async requestDefaultMetricsConfig(): Promise<any> {
    const isLocalStoreAvailable = localStorageAvailable()

    if (isLocalStoreAvailable) {
      const cachedConfig = window.localStorage.getItem("stMetricsConfig")
      if (cachedConfig) {
        this.metricsUrl = cachedConfig
        return
      }
    }

    try {
      const response = await fetch(DEFAULT_METRICS_CONFIG, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        this.metricsUrl = undefined
        LOG.error("Failed to fetch metrics config: ", response.status)
      } else {
        const data = await response.json()
        this.metricsUrl = data.url ?? undefined
        if (isLocalStoreAvailable && this.metricsUrl) {
          window.localStorage.setItem("stMetricsConfig", this.metricsUrl)
        }
      }
    } catch (err) {
      LOG.error("Failed to fetch metrics config:", err)
    }
  }

  // The schema of metrics events (including key names and value types) should
  // only be changed when requested by the data team. This is why `reportHash`
  // retains its old name.
  private send(evName: EventName, evData: Partial<IMetricsEvent> = {}): void {
    const data = this.buildEventProto(evName, evData)

    // Don't actually track events when in dev mode, just print them instead.
    if (IS_DEV_ENV) {
      LOG.info("[Dev mode] Not tracking stat datapoint: ", evName, data)
    } else if (this.metricsUrl === "postMessage") {
      this.postMessageEvent(evName, data)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      this.track(data)
    }
  }

  private sendPendingEvents(): void {
    this.pendingEvents.forEach(([evName, evData]) => {
      this.send(evName, evData)
    })
    this.pendingEvents = []
  }

  private async track(data: MetricsEvent): Promise<void> {
    // Send the event to the metrics URL
    // @ts-expect-error - send func calls track & checks metricsUrl defined
    const request = new Request(this.metricsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data.toJSON()),
    })
    await fetch(request)
  }

  // Helper to send metrics events to host
  private postMessageEvent(eventName: EventName, data: MetricsEvent): void {
    this.sendMessageToHost({
      type: "METRICS_EVENT",
      eventName,
      data,
    })
  }

  // Helper to build the event proto
  private buildEventProto(
    evName: EventName,
    data: Partial<IMetricsEvent>
  ): MetricsEvent {
    const eventProto = new MetricsEvent({
      event: evName,
      anonymousId: this.anonymousId,
      ...this.getHostTrackingData(),
      ...this.getInstallationData(),
      reportHash: this.appHash,
      dev: IS_DEV_ENV,
      source: "browser",
      streamlitVersion: this.sessionInfo.current.streamlitVersion,
      isHello: this.sessionInfo.isHello,
      appId: this.sessionInfo.current.appId,
      sessionId: this.sessionInfo.current.sessionId,
      pythonVersion: this.sessionInfo.current.pythonVersion,
      serverOs: this.sessionInfo.current.serverOS,
      hasDisplay: this.sessionInfo.current.hasDisplay,
      isWebdriver: isWebdriver(),
      ...this.getContextData(),
    })

    if (evName === "menuClick") {
      eventProto.label = data.label as string
    } else if (evName === "pageProfile") {
      return new MetricsEvent({ ...eventProto, ...data })
    }

    return eventProto
  }

  // Get the installation IDs from the session
  private getInstallationData(): Partial<IMetricsEvent> {
    return {
      machineIdV3: this.sessionInfo.current.installationIdV3,
      machineIdV4: this.sessionInfo.current.installationIdV4,
    }
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

  // Get context data for events
  private getContextData(): Partial<IMetricsEvent> {
    return {
      contextPageUrl: window.location.href,
      contextPageTitle: document.title,
      contextPagePath: window.location.pathname,
      contextPageReferrer: document.referrer,
      contextPageSearch: window.location.search,
      contextLocale: window.navigator.language,
      contextUserAgent: window.navigator.userAgent,
    }
  }

  /**
   * Get/Create user's anonymous ID
   * Checks if existing in cookie or localStorage, otherwise generates
   * a new UUID and stores it in both.
   */
  private getAnonymousId(): void {
    // If metrics disabled, anonymous ID unnecessary
    if (!this.actuallySendMetrics) return

    const anonymousIdKey = "ajs_anonymous_id"
    const isLocalStoreAvailable = localStorageAvailable()

    const anonymousIdCookie = getCookie(anonymousIdKey)
    const anonymousIdLocalStorage = isLocalStoreAvailable
      ? window.localStorage.getItem(anonymousIdKey)
      : null

    const expiration = new Date()
    expiration.setFullYear(new Date().getFullYear() + 1)

    if (anonymousIdCookie) {
      this.anonymousId = anonymousIdCookie

      if (isLocalStoreAvailable) {
        window.localStorage.setItem(anonymousIdKey, anonymousIdCookie)
      }
    } else if (anonymousIdLocalStorage) {
      try {
        // parse handles legacy anonymousId logic with excess quotes
        this.anonymousId = JSON.parse(anonymousIdLocalStorage)
      } catch {
        // if parse fails, anonymousId is not legacy and we can use as is
        this.anonymousId = anonymousIdLocalStorage
      }

      setCookie(anonymousIdKey, this.anonymousId, expiration)
    } else {
      this.anonymousId = uuidv4()

      setCookie(anonymousIdKey, this.anonymousId, expiration)
      if (isLocalStoreAvailable) {
        window.localStorage.setItem(anonymousIdKey, this.anonymousId)
      }
    }
  }
}

function isWebdriver(): boolean {
  return window.navigator?.webdriver ?? false
}
