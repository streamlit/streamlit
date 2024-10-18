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

// Disable Typescript checking, since mm.track has private scope
// @ts-nocheck
import UAParser from "ua-parser-js"

import {
  mockSessionInfo,
  mockSessionInfoProps,
  SessionInfo,
  setCookie,
} from "@streamlit/lib"

import { DEFAULT_METRICS_CONFIG, MetricsManager } from "./MetricsManager"

const getMetricsManager = (
  sessionInfo?: SessionInfo,
  metricsConfig: string = DEFAULT_METRICS_CONFIG,
  mockRequestDefaultMetricsConfig = true
): MetricsManager => {
  const mm = new MetricsManager(sessionInfo || mockSessionInfo())
  if (mockRequestDefaultMetricsConfig) {
    mm.requestDefaultMetricsConfig = jest.fn()
  }
  mm.setMetricsConfig(metricsConfig)
  mm.track = jest.fn()
  mm.identify = jest.fn()
  return mm
}

// Mock fetch for our metrics config request
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({ url: "https://data.streamlit.io/metrics.json" }),
  })
)

// Mock AbortSignal, otherwise TypeError timeout is not a function
global.AbortSignal = {
  timeout: jest.fn(),
}

afterEach(() => {
  window.analytics = undefined
  window.localStorage.clear()
  setCookie("ajs_anonymous_id")
})

test("does not track while uninitialized", () => {
  const mm = getMetricsManager()

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)
})

describe("setMetricsConfig", () => {
  test("does not track when metrics config set to off", () => {
    const mm = getMetricsManager(undefined, "off")

    mm.enqueue("ev1", { data1: 11 })
    mm.enqueue("ev2", { data2: 12 })
    mm.enqueue("ev3", { data3: 13 })

    expect(mm.track.mock.calls.length).toBe(0)
  })

  test("calls requestDefaultMetricsConfig when none received", () => {
    const mm = getMetricsManager(undefined, "")

    expect(mm.requestDefaultMetricsConfig.mock.calls.length).toBe(1)
  })

  test("attempts fetch when no metrics config received", () => {
    // eslint-disable-next-line no-proto
    const getItemSpy = jest.spyOn(window.localStorage.__proto__, "getItem")
    getMetricsManager(undefined, "", false)

    // Checks for cached config first
    expect(getItemSpy).toBeCalledWith("stMetricsConfig")
    // Fetches if no cached config
    expect(fetch.mock.calls.length).toBe(1)
    expect(fetch.mock.calls[0][0]).toEqual(DEFAULT_METRICS_CONFIG)
  })
})

// TODO: Build convenience method for checking general expected fields
describe("metrics helpers", () => {
  const result = new UAParser().getResult()

  const expectedEventData = {
    reportHash: "Not initialized",
    dev: false,
    source: "browser",
    streamlitVersion: "mockStreamlitVersion",
    isHello: false,
    machineIdV3: "mockInstallationIdV3",
    contextPageUrl: window.location.href,
    contextPageTitle: document.title,
    contextPagePath: window.location.pathname,
    contextPageReferrer: document.referrer,
    contextPageSearch: window.location.search,
    contextLocale: window.navigator.userLanguage || window.navigator.language,
    contextUserAgent: window.navigator.userAgent,
  }

  const pageProfileEventData = {
    commands: [],
    execTime: 50,
    prepTime: 50,
    config: {},
    uncaughtException: [],
    attributions: ["streamlit_extras"],
    timezone: "('UTC', 'UTC')",
    headless: false,
    isFragmentRun: false,
    os: result.os.name || "Unknown",
    appId: "mockAppId",
    numPages: 1,
    sessionId: "mockSessionId",
    pythonVersion: "7.7.7",
    pageScriptHash: "mockPageScriptHash",
    activeTheme: "Use system setting",
    totalLoadTime: 100,
    browserName: result.browser.name || "Unknown",
    browserVersion: result.browser.version || "Unknown",
    deviceType: result.device.type || "Unknown",
  }

  test("buildEventProto populates expected fields - viewReport", () => {
    const mm = getMetricsManager()
    mm.initialize({ gatherUsageStats: true })
    const viewReportProto = mm.buildEventProto("viewReport")

    expect(viewReportProto.event).toEqual("viewReport")
    // General Metrics Fields
    expect(viewReportProto.anonymousId).toHaveLength(36)
    expect(viewReportProto.reportHash).toEqual("Not initialized")
    expect(viewReportProto.dev).toEqual(false)
    expect(viewReportProto.source).toEqual("browser")
    expect(viewReportProto.streamlitVersion).toEqual("mockStreamlitVersion")
    expect(viewReportProto.isHello).toEqual(false)
    expect(viewReportProto.machineIdV3).toEqual("mockInstallationIdV3")
    // Context Data Fields
    expect(viewReportProto.contextPageUrl).toEqual(
      expectedEventData.contextPageUrl
    )
    expect(viewReportProto.contextPageTitle).toEqual(
      expectedEventData.contextPageTitle
    )
    expect(viewReportProto.contextPagePath).toEqual(
      expectedEventData.contextPagePath
    )
    expect(viewReportProto.contextPageReferrer).toEqual(
      expectedEventData.contextPageReferrer
    )
    expect(viewReportProto.contextPageSearch).toEqual(
      expectedEventData.contextPageSearch
    )
    expect(viewReportProto.contextLocale).toEqual(
      expectedEventData.contextLocale
    )
    expect(viewReportProto.contextUserAgent).toEqual(
      expectedEventData.contextUserAgent
    )
  })

  test("buildEventProto populates expected fields - updateReport", () => {
    const mm = getMetricsManager()
    mm.initialize({ gatherUsageStats: true })
    mm.setAppHash("mockAppHash")
    const updateReportProto = mm.buildEventProto("updateReport")

    expect(updateReportProto.event).toEqual("updateReport")
    // General Metrics Fields
    expect(updateReportProto.anonymousId).toHaveLength(36)
    expect(updateReportProto.reportHash).toEqual("mockAppHash")
    expect(updateReportProto.dev).toEqual(false)
    expect(updateReportProto.source).toEqual("browser")
    expect(updateReportProto.streamlitVersion).toEqual("mockStreamlitVersion")
    expect(updateReportProto.isHello).toEqual(false)
    expect(updateReportProto.machineIdV3).toEqual("mockInstallationIdV3")
    // Context Data Fields
    expect(updateReportProto.contextPageUrl).toEqual(
      expectedEventData.contextPageUrl
    )
    expect(updateReportProto.contextPageTitle).toEqual(
      expectedEventData.contextPageTitle
    )
    expect(updateReportProto.contextPagePath).toEqual(
      expectedEventData.contextPagePath
    )
    expect(updateReportProto.contextPageReferrer).toEqual(
      expectedEventData.contextPageReferrer
    )
    expect(updateReportProto.contextPageSearch).toEqual(
      expectedEventData.contextPageSearch
    )
    expect(updateReportProto.contextLocale).toEqual(
      expectedEventData.contextLocale
    )
    expect(updateReportProto.contextUserAgent).toEqual(
      expectedEventData.contextUserAgent
    )
  })

  test("buildEventProto populates expected fields - pageProfile", () => {
    const mm = getMetricsManager()
    mm.initialize({ gatherUsageStats: true })
    mm.setAppHash("mockAppHash")
    const pageProfileProto = mm.buildEventProto(
      "pageProfile",
      pageProfileEventData
    )

    expect(pageProfileProto.event).toEqual("pageProfile")
    // General Metrics Fields
    expect(pageProfileProto.anonymousId).toHaveLength(36)
    expect(pageProfileProto.reportHash).toEqual("mockAppHash")
    expect(pageProfileProto.dev).toEqual(false)
    expect(pageProfileProto.source).toEqual("browser")
    expect(pageProfileProto.streamlitVersion).toEqual("mockStreamlitVersion")
    expect(pageProfileProto.isHello).toEqual(false)
    expect(pageProfileProto.machineIdV3).toEqual("mockInstallationIdV3")
    // Context Data Fields
    expect(pageProfileProto.contextPageUrl).toEqual(
      expectedEventData.contextPageUrl
    )
    expect(pageProfileProto.contextPageTitle).toEqual(
      expectedEventData.contextPageTitle
    )
    expect(pageProfileProto.contextPagePath).toEqual(
      expectedEventData.contextPagePath
    )
    expect(pageProfileProto.contextPageReferrer).toEqual(
      expectedEventData.contextPageReferrer
    )
    expect(pageProfileProto.contextPageSearch).toEqual(
      expectedEventData.contextPageSearch
    )
    expect(pageProfileProto.contextLocale).toEqual(
      expectedEventData.contextLocale
    )
    expect(pageProfileProto.contextUserAgent).toEqual(
      expectedEventData.contextUserAgent
    )
    // Additional Page Profile Event Fields
    expect(pageProfileProto.commands).toEqual(pageProfileEventData.commands)
    expect(pageProfileProto.execTime).toEqual(pageProfileEventData.execTime)
    expect(pageProfileProto.prepTime).toEqual(pageProfileEventData.prepTime)
    expect(pageProfileProto.config).toEqual(pageProfileEventData.config)
    expect(pageProfileProto.uncaughtException).toEqual(
      pageProfileEventData.uncaughtException
    )
    expect(pageProfileProto.attributions).toEqual(
      pageProfileEventData.attributions
    )
    expect(pageProfileProto.timezone).toEqual(pageProfileEventData.timezone)
    expect(pageProfileProto.headless).toEqual(pageProfileEventData.headless)
    expect(pageProfileProto.isFragmentRun).toEqual(
      pageProfileEventData.isFragmentRun
    )
    expect(pageProfileProto.os).toEqual(pageProfileEventData.os)
    expect(pageProfileProto.appId).toEqual(pageProfileEventData.appId)
    expect(pageProfileProto.numPages).toEqual(pageProfileEventData.numPages)
    expect(pageProfileProto.sessionId).toEqual(pageProfileEventData.sessionId)
    expect(pageProfileProto.pythonVersion).toEqual(
      pageProfileEventData.pythonVersion
    )
    expect(pageProfileProto.pageScriptHash).toEqual(
      pageProfileEventData.pageScriptHash
    )
    expect(pageProfileProto.activeTheme).toEqual(
      pageProfileEventData.activeTheme
    )
    expect(pageProfileProto.totalLoadTime).toEqual(
      pageProfileEventData.totalLoadTime
    )
    expect(pageProfileProto.browserName).toEqual(
      pageProfileEventData.browserName
    )
    expect(pageProfileProto.browserVersion).toEqual(
      pageProfileEventData.browserVersion
    )
    expect(pageProfileProto.deviceType).toEqual(
      pageProfileEventData.deviceType
    )
  })

  test("buildEventProto populates expected fields - menuClick", () => {
    const mm = getMetricsManager()
    mm.initialize({ gatherUsageStats: true })
    mm.setAppHash("mockAppHash")
    const menuClickProto = mm.buildEventProto("menuClick", {
      label: "mockLabel",
    })

    expect(menuClickProto.event).toEqual("menuClick")
    // General Metrics Fields
    expect(menuClickProto.anonymousId).toHaveLength(36)
    expect(menuClickProto.reportHash).toEqual("mockAppHash")
    expect(menuClickProto.dev).toEqual(false)
    expect(menuClickProto.source).toEqual("browser")
    expect(menuClickProto.streamlitVersion).toEqual("mockStreamlitVersion")
    expect(menuClickProto.isHello).toEqual(false)
    expect(menuClickProto.machineIdV3).toEqual("mockInstallationIdV3")
    // Context Data Fields
    expect(menuClickProto.contextPageUrl).toEqual(
      expectedEventData.contextPageUrl
    )
    expect(menuClickProto.contextPageTitle).toEqual(
      expectedEventData.contextPageTitle
    )
    expect(menuClickProto.contextPagePath).toEqual(
      expectedEventData.contextPagePath
    )
    expect(menuClickProto.contextPageReferrer).toEqual(
      expectedEventData.contextPageReferrer
    )
    expect(menuClickProto.contextPageSearch).toEqual(
      expectedEventData.contextPageSearch
    )
    expect(menuClickProto.contextLocale).toEqual(
      expectedEventData.contextLocale
    )
    expect(menuClickProto.contextUserAgent).toEqual(
      expectedEventData.contextUserAgent
    )
    // Additional Menu Click Event Fields
    expect(menuClickProto.label).toEqual("mockLabel")
  })

  test("getAnonymousId is called on initialization & returns a uuid", () => {
    const mm = getMetricsManager()
    expect(mm.anonymousId).toBe("")
    mm.initialize({ gatherUsageStats: true })
    expect(mm.anonymousId).toHaveLength(36)
  })

  test("getAnonymousId checks for cached anonymousId in cookie and localStorage", () => {
    expect(localStorage.getItem("ajs_anonymous_id")).toBeNull()
    expect(document.cookie).not.toContain("ajs_anonymous_id")

    const setCookieSpy = jest.spyOn(document, "cookie", "set")
    const getCookieSpy = jest.spyOn(document, "cookie", "get")
    // eslint-disable-next-line no-proto
    const getItemSpy = jest.spyOn(window.localStorage.__proto__, "getItem")
    const setItemSpy = jest.spyOn(window.localStorage.__proto__, "setItem")

    const mm = getMetricsManager()
    mm.initialize({ gatherUsageStats: true })
    expect(getItemSpy).toBeCalledWith("ajs_anonymous_id")
    expect(getCookieSpy).toHaveBeenCalled()
    expect(setCookieSpy).toHaveBeenCalled()
    expect(setItemSpy).toHaveBeenCalled()
    expect(mm.anonymousId).toHaveLength(36)
    expect(localStorage.getItem("ajs_anonymous_id")).toHaveLength(36)
    expect(document.cookie).toContain("ajs_anonymous_id")
  })
})

test("does not track when initialized with gatherUsageStats=false", () => {
  const mm = getMetricsManager()
  mm.initialize({ gatherUsageStats: false })

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)
})

test("does not initialize Segment analytics when gatherUsageStats=false", () => {
  const mm = getMetricsManager()
  expect(window.analytics).toBeUndefined()
  mm.initialize({ gatherUsageStats: false })
  expect(window.analytics).toBeUndefined()
})

test("initializes Segment analytics when gatherUsageStats=true", () => {
  const mm = getMetricsManager()
  expect(window.analytics).toBeUndefined()
  mm.initialize({ gatherUsageStats: true })
  expect(window.analytics).toBeDefined()
  expect(window.analytics.invoked).toBe(true)
  expect(window.analytics.methods).toHaveLength(20)
  expect(window.analytics.load).toBeDefined()
})

test("enqueues events before initialization", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)

  mm.initialize({ gatherUsageStats: true })

  expect(mm.track.mock.calls.length).toBe(3)
})

test("enqueues events when disconnected, then sends them when connected again", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)
  mm.initialize({ gatherUsageStats: true })

  // "Disconnect" our SessionInfo. Enqueued events should not be tracked.
  sessionInfo.setCurrent(undefined)
  expect(sessionInfo.isSet).toBe(false)

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)

  // Initialize the SessionInfo. The next call to enqueue should cause
  // all of our enqueued messages to get tracked.
  sessionInfo.setCurrent(mockSessionInfoProps())
  mm.enqueue("ev4", { data4: 14 })
  expect(mm.track.mock.calls.length).toBe(4)
})

test("tracks events immediately after initialized", () => {
  const mm = getMetricsManager()
  mm.initialize({ gatherUsageStats: true })

  expect(mm.track.mock.calls.length).toBe(0)
  mm.enqueue("ev1", { data1: 11 })
  expect(mm.track.mock.calls.length).toBe(1)
  mm.enqueue("ev2", { data2: 12 })
  expect(mm.track.mock.calls.length).toBe(2)
  mm.enqueue("ev3", { data3: 13 })
  expect(mm.track.mock.calls.length).toBe(3)
})

test("tracks host data when in an iFrame", () => {
  const mm = getMetricsManager()
  mm.setMetadata({
    hostedAt: "S4A",
    k: "v",
  })
  mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  expect(mm.track.mock.calls[0][1]).toMatchObject({
    hostedAt: "S4A",
    data1: 11,
  })
  expect(mm.track.mock.calls[0][1]).not.toMatchObject({
    k: "v",
  })
})

test("tracks installation data", () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)
  mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  expect(mm.track.mock.calls[0][1]).toMatchObject({
    machineIdV3: sessionInfo.current.installationIdV3,
  })
})

test("ip address is overwritten", () => {
  const mm = getMetricsManager()
  mm.initialize({ gatherUsageStats: true })

  mm.enqueue("ev1", { data1: 11 })

  expect(mm.track.mock.calls[0][2]).toMatchObject({
    context: {
      ip: "0.0.0.0",
    },
  })
})
