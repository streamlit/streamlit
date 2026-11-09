/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { pick } from "lodash-es"
import { getLogger } from "loglevel"

import { IS_DEV_ENV } from "@streamlit/connection"
import {
  type DeployedAppMetadata,
  type IGuestToHostMessage,
  type SessionInfo,
  setCookie,
} from "@streamlit/lib"
import { MetricsEvent } from "@streamlit/protobuf"
import {
  generateUuid,
  getCookie,
  localStorageAvailable,
} from "@streamlit/utils"

// Default metrics config fetched when none provided by host config endpoint
export const DEFAULT_METRICS_CONFIG = "https://data.streamlit.io/metrics.json"

/** localStorage key for cached metrics destinations (url list + fetch time). */
export const METRICS_CONFIG_CACHE_KEY = "stMetricsConfig.v2"

/**
 * Single-URL cache key from older Streamlit versions, which never expire it.
 * Removed on cache write; never read.
 */
export const LEGACY_METRICS_CONFIG_CACHE_KEY = "stMetricsConfig"

/** How long a cached metrics.json response is reused before refetching. */
export const METRICS_CONFIG_TTL_MS = 7 * 24 * 60 * 60 * 1000

const LOG = getLogger("MetricsManager")

type EventName = "viewReport" | "updateReport" | "pageProfile" | "menuClick"
type Event = [EventName, Partial<MetricsEvent.$Properties>]

type MetricsConfigCache = {
  urls: string[]
  fetchedAt: number
}

/**
 * Parse remote metrics config JSON into HTTPS destination URLs.
 *
 * Uses `urls` when it contains at least one HTTPS URL; otherwise uses the
 * legacy `url` string. Keep in sync with `_parse_metrics_destinations` in
 * `lib/streamlit/runtime/credentials.py`.
 */
export function parseMetricsDestinations(data: unknown): string[] {
  if (!data || typeof data !== "object") {
    return []
  }

  const record = data as { url?: unknown; urls?: unknown }
  const destinations: string[] = []

  if (Array.isArray(record.urls)) {
    for (const entry of record.urls) {
      if (typeof entry === "string" && hasHttpsScheme(entry)) {
        if (!destinations.includes(entry)) {
          destinations.push(entry)
        }
      }
    }
  }

  if (destinations.length > 0) {
    return destinations
  }

  if (typeof record.url === "string" && hasHttpsScheme(record.url)) {
    return [record.url]
  }

  return []
}

/** True when `value` starts with `https://` (does not parse the URL). */
function hasHttpsScheme(value: string): boolean {
  return value.startsWith("https://")
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
   * Host metrics mode: unset, "off", "postMessage", or a single HTTPS override.
   */
  private metricsUrl: string | undefined = undefined

  /**
   * HTTPS destinations that receive POSTed metrics events.
   */
  private metricsDestinations: string[] = []

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

    // Fetch default metrics config when the host did not provide a mode/URL.
    if (this.actuallySendMetrics && !this.metricsUrl) {
      await this.requestDefaultMetricsConfig()
    }

    // postMessage mode has no HTTP destinations; URL mode must resolve at least one.
    if (
      this.actuallySendMetrics &&
      this.metricsUrl !== "postMessage" &&
      this.metricsDestinations.length === 0
    ) {
      LOG.error("Undefined metrics config - deactivating metrics tracking.")
      this.actuallySendMetrics = false
    }

    if (this.actuallySendMetrics) {
      this.sendPendingEvents()
    }

    LOG.info("Gather usage stats: ", this.actuallySendMetrics)
    this.initialized = true
  }

  public enqueue(
    evName: EventName,
    evData: Partial<MetricsEvent.$Properties> = {}
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
    if (metricsUrl && metricsUrl !== "off" && metricsUrl !== "postMessage") {
      if (hasHttpsScheme(metricsUrl)) {
        this.metricsDestinations = [metricsUrl]
      } else {
        LOG.error(
          "Rejected non-HTTPS metricsUrl host override - deactivating HTTP metrics:",
          metricsUrl
        )
        this.metricsDestinations = []
      }
    } else {
      this.metricsDestinations = []
    }
  }

  public setMetadata(metadata: DeployedAppMetadata): void {
    this.metadata = metadata
  }

  /**
   * Resolve metrics destinations from a fresh cache, else from metrics.json,
   * else from the stale cache.
   */
  private async requestDefaultMetricsConfig(): Promise<void> {
    const isLocalStoreAvailable = localStorageAvailable()
    const cached = isLocalStoreAvailable ? this.readMetricsConfigCache() : null
    const now = Date.now()

    if (cached && now - cached.fetchedAt < METRICS_CONFIG_TTL_MS) {
      this.metricsDestinations = cached.urls
      return
    }

    try {
      const response = await fetch(DEFAULT_METRICS_CONFIG, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        LOG.error("Failed to fetch metrics config: ", response.status)
        this.metricsDestinations = cached?.urls ?? []
        return
      }

      const data: unknown = await response.json()
      const destinations = parseMetricsDestinations(data)
      this.metricsDestinations = destinations

      if (!isLocalStoreAvailable) {
        return
      }

      try {
        if (destinations.length > 0) {
          this.writeMetricsConfigCache({ urls: destinations, fetchedAt: now })
        } else {
          // Successful empty config must not leave stale destinations to revive later.
          window.localStorage.removeItem(METRICS_CONFIG_CACHE_KEY)
          window.localStorage.removeItem(LEGACY_METRICS_CONFIG_CACHE_KEY)
        }
      } catch (cacheErr) {
        // Keep the parsed destinations even if localStorage write/remove fails.
        LOG.error("Failed to update metrics config cache:", cacheErr)
      }
    } catch (err) {
      LOG.error("Failed to fetch metrics config:", err)
      this.metricsDestinations = cached?.urls ?? []
    }
  }

  private readMetricsConfigCache(): MetricsConfigCache | null {
    try {
      const raw = window.localStorage.getItem(METRICS_CONFIG_CACHE_KEY)
      if (!raw) {
        return null
      }
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") {
        return null
      }
      const record = parsed as { urls?: unknown; fetchedAt?: unknown }
      if (
        !Array.isArray(record.urls) ||
        typeof record.fetchedAt !== "number" ||
        !Number.isFinite(record.fetchedAt)
      ) {
        return null
      }
      const urls = record.urls.filter(
        (entry): entry is string =>
          typeof entry === "string" && hasHttpsScheme(entry)
      )
      if (urls.length === 0) {
        return null
      }
      return { urls, fetchedAt: record.fetchedAt }
    } catch {
      return null
    }
  }

  private writeMetricsConfigCache(cache: MetricsConfigCache): void {
    window.localStorage.setItem(
      METRICS_CONFIG_CACHE_KEY,
      JSON.stringify(cache)
    )
    // Older Streamlit versions on this origin cache this key forever; removing
    // it makes them refetch the config.
    window.localStorage.removeItem(LEGACY_METRICS_CONFIG_CACHE_KEY)
  }

  // The schema of metrics events (including key names and value types) should
  // only be changed when requested by the data team. This is why `reportHash`
  // retains its old name.
  private send(
    evName: EventName,
    evData: Partial<MetricsEvent.$Properties> = {}
  ): void {
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
    const body = JSON.stringify(data.toJSON())
    // Async map so a sync Request/URL parse error on one destination
    // becomes a rejection and does not skip later destinations.
    await Promise.allSettled(
      this.metricsDestinations.map(async url =>
        fetch(
          new Request(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body,
          })
        )
      )
    )
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
    data: Partial<MetricsEvent.$Properties>
  ): MetricsEvent {
    const eventProperties: MetricsEvent.$Properties = {
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
    }

    if (evName === "menuClick") {
      eventProperties.label = data.label
      // Optional surface dimension (e.g. "toast", "errorCallout") attributing
      // the click to the UI surface that emitted it. Left unset for menu
      // clicks that don't provide one.
      if (data.surface) {
        eventProperties.surface = data.surface
      }
    } else if (evName === "pageProfile") {
      // Merge plain property objects; a MetricsEvent instance is not a plain record.
      return new MetricsEvent({ ...eventProperties, ...data })
    }

    return new MetricsEvent(eventProperties)
  }

  // Get the installation IDs from the session
  private getInstallationData(): Partial<MetricsEvent.$Properties> {
    return {
      machineIdV3: this.sessionInfo.current.installationIdV3,
      machineIdV4: this.sessionInfo.current.installationIdV4,
    }
  }

  // Use the tracking data injected by the host of the app if included.
  private getHostTrackingData(): DeployedAppMetadata {
    return pick(this.metadata, [
      "hostedAt",
      "owner",
      "repo",
      "branch",
      "mainModule",
      "creatorId",
    ])
  }

  // Get context data for events
  private getContextData(): Partial<MetricsEvent.$Properties> {
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
      this.anonymousId = generateUuid()

      setCookie(anonymousIdKey, this.anonymousId, expiration)
      if (isLocalStoreAvailable) {
        window.localStorage.setItem(anonymousIdKey, this.anonymousId)
      }
    }
  }
}

function isWebdriver(): boolean {
  // The DOM lib types navigator.webdriver as always present, but some embedded
  // WebViews and older browsers leave it undefined. Report those as false.
  return Boolean(window.navigator.webdriver)
}
