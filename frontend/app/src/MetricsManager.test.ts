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

// Disable Typescript checking, since mm.track has private scope
// @ts-nocheck

import UAParser from "ua-parser-js"

import {
  MetricsEvent,
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
    mm.requestDefaultMetricsConfig = vi.fn()
  }
  mm.setMetricsConfig(metricsConfig)
  mm.track = vi.fn()
  mm.identify = vi.fn()
  mm.postMessageEvent = vi.fn()
  return mm
}

const originalWebdriver = window.navigator.webdriver

// Mock fetch for our metrics config request
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({ url: "https://data.streamlit.io/metrics.json" }),
  })
)

// Mock AbortSignal, otherwise TypeError timeout is not a function
global.AbortSignal = {
  timeout: vi.fn(),
}

const DEFAULT_EVENT_DATA = {
  reportHash: "Not initialized",
  dev: false,
  source: "browser",
  streamlitVersion: "mockStreamlitVersion",
  isHello: false,
  machineIdV3: "mockInstallationIdV3",
  machineIdV4: "mockInstallationIdV4",
  contextPageUrl: window.location.href,
  contextPageTitle: document.title,
  contextPagePath: window.location.pathname,
  contextPageReferrer: document.referrer,
  contextPageSearch: window.location.search,
  contextLocale: window.navigator.userLanguage || window.navigator.language,
  contextUserAgent: window.navigator.userAgent,
}

const UPDATE_EVENT_DATA = {
  ...DEFAULT_EVENT_DATA,
  reportHash: "mockAppHash",
}

// Checks generic metric event fields
const checkDefaultEventData = (
  generatedProto: MetricsEvent,
  afterUpdateReport = true
): void => {
  const expectedData = afterUpdateReport
    ? UPDATE_EVENT_DATA
    : DEFAULT_EVENT_DATA
  // Check general metrics fields
  expect(generatedProto.anonymousId).toHaveLength(36)
  expect(generatedProto.reportHash).toEqual(expectedData.reportHash)
  expect(generatedProto.dev).toEqual(expectedData.dev)
  expect(generatedProto.source).toEqual(expectedData.source)
  expect(generatedProto.streamlitVersion).toEqual(
    expectedData.streamlitVersion
  )
  expect(generatedProto.isHello).toEqual(expectedData.isHello)
  expect(generatedProto.machineIdV3).toEqual(expectedData.machineIdV3)
  expect(generatedProto.machineIdV4).toEqual(expectedData.machineIdV4)
  // Context Data Fields
  expect(generatedProto.contextPageUrl).toEqual(expectedData.contextPageUrl)
  expect(generatedProto.contextPageTitle).toEqual(
    expectedData.contextPageTitle
  )
  expect(generatedProto.contextPagePath).toEqual(expectedData.contextPagePath)
  expect(generatedProto.contextPageReferrer).toEqual(
    expectedData.contextPageReferrer
  )
  expect(generatedProto.contextPageSearch).toEqual(
    expectedData.contextPageSearch
  )
  expect(generatedProto.contextLocale).toEqual(expectedData.contextLocale)
  expect(generatedProto.contextUserAgent).toEqual(
    expectedData.contextUserAgent
  )
}

afterEach(() => {
  window.analytics = undefined
  window.navigator.webdriver = originalWebdriver
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

describe("initialize", () => {
  test("does not track when initialized with gatherUsageStats=false", async () => {
    const mm = getMetricsManager()
    await mm.initialize({ gatherUsageStats: false })

    mm.enqueue("ev1", { data1: 11 })
    mm.enqueue("ev2", { data2: 12 })
    mm.enqueue("ev3", { data3: 13 })

    expect(mm.track.mock.calls.length).toBe(0)
    expect(mm.actuallySendMetrics).toBe(false)
  })

  test("does not track when metrics config set to off", async () => {
    const mm = getMetricsManager(undefined, "off")
    await mm.initialize({ gatherUsageStats: true })

    mm.enqueue("ev1", { data1: 11 })
    mm.enqueue("ev2", { data2: 12 })
    mm.enqueue("ev3", { data3: 13 })

    expect(mm.track.mock.calls.length).toBe(0)
    expect(mm.actuallySendMetrics).toBe(false)
  })

  test("does not call requestDefaultMetricsConfig when metrics config set", async () => {
    const mm = getMetricsManager()
    await mm.initialize({ gatherUsageStats: true })

    expect(mm.requestDefaultMetricsConfig.mock.calls.length).toBe(0)
  })

  test("calls requestDefaultMetricsConfig when no metrics config received", async () => {
    const mm = getMetricsManager(undefined, "")
    await mm.initialize({ gatherUsageStats: true })

    expect(mm.requestDefaultMetricsConfig.mock.calls.length).toBe(1)
  })

  test("attempts fetch when no metrics config received", async () => {
    // eslint-disable-next-line no-proto
    const getItemSpy = vi.spyOn(window.localStorage.__proto__, "getItem")
    const mm = getMetricsManager(undefined, "", false)
    await mm.initialize({ gatherUsageStats: true })

    // Checks for cached config first
    expect(getItemSpy).toBeCalledWith("stMetricsConfig")
    // Fetches if no cached config
    expect(fetch.mock.calls.length).toBe(1)
    expect(fetch.mock.calls[0][0]).toEqual(DEFAULT_METRICS_CONFIG)
  })
})

describe("metrics helpers", () => {
  const RESULT = new UAParser().getResult()

  const PAGE_PROFILE_DATA = {
    commands: [],
    execTime: 50,
    prepTime: 50,
    config: {},
    uncaughtException: [],
    attributions: ["streamlit_extras"],
    timezone: "('UTC', 'UTC')",
    headless: false,
    isFragmentRun: false,
    os: RESULT.os.name || "Unknown",
    appId: "mockAppId",
    numPages: 1,
    sessionId: "mockSessionId",
    pythonVersion: "7.7.7",
    pageScriptHash: "mockPageScriptHash",
    activeTheme: "Use system setting",
    totalLoadTime: 100,
    browserName: RESULT.browser.name || "Unknown",
    browserVersion: RESULT.browser.version || "Unknown",
    deviceType: RESULT.device.type || "Unknown",
  }
  test("buildEventProto populates expected fields - viewReport", async () => {
    const mm = getMetricsManager()
    await mm.initialize({ gatherUsageStats: true })
    const viewReportProto = mm.buildEventProto("viewReport")

    expect(viewReportProto.event).toEqual("viewReport")
    checkDefaultEventData(viewReportProto, false)
  })

  test("buildEventProto populates expected fields - updateReport", async () => {
    const mm = getMetricsManager()
    await mm.initialize({ gatherUsageStats: true })
    mm.setAppHash("mockAppHash")
    const updateReportProto = mm.buildEventProto("updateReport")

    expect(updateReportProto.event).toEqual("updateReport")
    checkDefaultEventData(updateReportProto)
  })

  test("buildEventProto populates expected fields - pageProfile", async () => {
    const mm = getMetricsManager()
    await mm.initialize({ gatherUsageStats: true })
    mm.setAppHash("mockAppHash")
    const pageProfileProto = mm.buildEventProto(
      "pageProfile",
      PAGE_PROFILE_DATA
    )

    expect(pageProfileProto.event).toEqual("pageProfile")
    checkDefaultEventData(pageProfileProto)
    // Additional Page Profile Event Fields
    expect(pageProfileProto.commands).toEqual(PAGE_PROFILE_DATA.commands)
    expect(pageProfileProto.execTime).toEqual(PAGE_PROFILE_DATA.execTime)
    expect(pageProfileProto.prepTime).toEqual(PAGE_PROFILE_DATA.prepTime)
    expect(pageProfileProto.config).toEqual(PAGE_PROFILE_DATA.config)
    expect(pageProfileProto.uncaughtException).toEqual(
      PAGE_PROFILE_DATA.uncaughtException
    )
    expect(pageProfileProto.attributions).toEqual(
      PAGE_PROFILE_DATA.attributions
    )
    expect(pageProfileProto.timezone).toEqual(PAGE_PROFILE_DATA.timezone)
    expect(pageProfileProto.headless).toEqual(PAGE_PROFILE_DATA.headless)
    expect(pageProfileProto.isFragmentRun).toEqual(
      PAGE_PROFILE_DATA.isFragmentRun
    )
    expect(pageProfileProto.os).toEqual(PAGE_PROFILE_DATA.os)
    expect(pageProfileProto.appId).toEqual(PAGE_PROFILE_DATA.appId)
    expect(pageProfileProto.numPages).toEqual(PAGE_PROFILE_DATA.numPages)
    expect(pageProfileProto.sessionId).toEqual(PAGE_PROFILE_DATA.sessionId)
    expect(pageProfileProto.pythonVersion).toEqual(
      PAGE_PROFILE_DATA.pythonVersion
    )
    expect(pageProfileProto.pageScriptHash).toEqual(
      PAGE_PROFILE_DATA.pageScriptHash
    )
    expect(pageProfileProto.activeTheme).toEqual(PAGE_PROFILE_DATA.activeTheme)
    expect(pageProfileProto.totalLoadTime).toEqual(
      PAGE_PROFILE_DATA.totalLoadTime
    )
    expect(pageProfileProto.browserName).toEqual(PAGE_PROFILE_DATA.browserName)
    expect(pageProfileProto.browserVersion).toEqual(
      PAGE_PROFILE_DATA.browserVersion
    )
    expect(pageProfileProto.deviceType).toEqual(PAGE_PROFILE_DATA.deviceType)
  })

  test("buildEventProto populates expected fields - menuClick", async () => {
    const mm = getMetricsManager()
    await mm.initialize({ gatherUsageStats: true })
    mm.setAppHash("mockAppHash")
    const menuClickProto = mm.buildEventProto("menuClick", {
      label: "mockLabel",
    })
    expect(menuClickProto.event).toEqual("menuClick")
    checkDefaultEventData(menuClickProto)
    // Additional Menu Click Event Fields
    expect(menuClickProto.label).toEqual("mockLabel")
  })

  test("getAnonymousId is called on initialization, saves uuid to this.anonymousId", async () => {
    const mm = getMetricsManager()
    expect(mm.anonymousId).toBe("")
    await mm.initialize({ gatherUsageStats: true })
    expect(mm.anonymousId).toHaveLength(36)
  })

  test("getAnonymousId checks for cached anonymousId in cookie and localStorage", async () => {
    expect(window.localStorage.getItem("ajs_anonymous_id")).toBeNull()
    expect(document.cookie).not.toContain("ajs_anonymous_id")

    const setCookieSpy = vi.spyOn(document, "cookie", "set")
    const getCookieSpy = vi.spyOn(document, "cookie", "get")
    // eslint-disable-next-line no-proto
    const getItemSpy = vi.spyOn(window.localStorage.__proto__, "getItem")
    // eslint-disable-next-line no-proto
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem")
    const mm = getMetricsManager()
    await mm.initialize({ gatherUsageStats: true })

    expect(getItemSpy).toBeCalledWith("ajs_anonymous_id")
    expect(getCookieSpy).toHaveBeenCalled()
    expect(setCookieSpy).toHaveBeenCalled()
    expect(setItemSpy).toHaveBeenCalled()
    expect(mm.anonymousId).toHaveLength(36)
    expect(window.localStorage.getItem("ajs_anonymous_id")).toHaveLength(36)
    expect(document.cookie).toContain("ajs_anonymous_id")
  })
})

test("sends events via postMessage when config set", async () => {
  const mm = getMetricsManager(undefined, "postMessage")
  await mm.initialize({ gatherUsageStats: true })

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)
  expect(mm.actuallySendMetrics).toBe(true)
  expect(mm.postMessageEvent.mock.calls.length).toBe(3)
})

test("enqueues events before initialization", async () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)

  mm.enqueue("ev1", { data1: 11 })
  mm.enqueue("ev2", { data2: 12 })
  mm.enqueue("ev3", { data3: 13 })

  expect(mm.track.mock.calls.length).toBe(0)

  await mm.initialize({ gatherUsageStats: true })

  expect(mm.track.mock.calls.length).toBe(3)
})

test("enqueues events when disconnected, then sends them when connected again", async () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)
  await mm.initialize({ gatherUsageStats: true })

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

test("tracks events immediately after initialized", async () => {
  const mm = getMetricsManager()
  await mm.initialize({ gatherUsageStats: true })

  expect(mm.track.mock.calls.length).toBe(0)
  mm.enqueue("ev1", { data1: 11 })
  expect(mm.track.mock.calls.length).toBe(1)
  mm.enqueue("ev2", { data2: 12 })
  expect(mm.track.mock.calls.length).toBe(2)
  mm.enqueue("ev3", { data3: 13 })
  expect(mm.track.mock.calls.length).toBe(3)
})

test("tracks host data when in an iFrame", async () => {
  const mm = getMetricsManager()
  mm.setMetadata({
    hostedAt: "S4A",
    k: "v",
  })
  await mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  const trackCall = mm.track.mock.calls[0][0]
  // Check that unexpected event data not included
  expect(trackCall.data1).not.toBeDefined()

  // Check that only expected metadata fields present (see getHostTrackingData)
  expect(trackCall.hostedAt).toEqual("S4A")
  expect(trackCall.k).not.toBeDefined()
})

test("tracks installation data", async () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)
  await mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  const trackCall = mm.track.mock.calls[0][0]
  expect(trackCall.machineIdV3).toEqual(sessionInfo.current.installationIdV3)
  expect(trackCall.machineIdV4).toEqual(sessionInfo.current.installationIdV4)
})

test("tracks server/local debug data", async () => {
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)
  await mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  const trackCall = mm.track.mock.calls[0][0]
  expect(trackCall.serverOs).toEqual(sessionInfo.current.serverOS)
  expect(trackCall.hasDisplay).toEqual(sessionInfo.current.hasDisplay)

  // This test runs outside a browser so isWebdriver should be false.
  expect(trackCall.isWebdriver).toEqual(false)
})

test("tracks server/local debug data with mocked webdriver", async () => {
  window.navigator.webdriver = true
  const sessionInfo = mockSessionInfo()
  const mm = getMetricsManager(sessionInfo)
  await mm.initialize({ gatherUsageStats: true })
  mm.enqueue("ev1", { data1: 11 })

  const trackCall = mm.track.mock.calls[0][0]
  expect(trackCall.serverOs).toEqual(sessionInfo.current.serverOS)
  expect(trackCall.hasDisplay).toEqual(sessionInfo.current.hasDisplay)

  // This test runs outside a browser so isWebdriver should be false.
  expect(trackCall.isWebdriver).toEqual(true)
})
