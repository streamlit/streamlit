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

/**
 * Returns cookie value
 */
export function getCookie(name: string): string | undefined {
  const r = document.cookie.match(`\\b${name}=([^;]*)\\b`)
  return r ? r[1] : undefined
}

// Method taken from
// https://stackoverflow.com/questions/16427636/check-if-localstorage-is-available
export function localStorageAvailable(): boolean {
  const testData = "testData"

  try {
    const { localStorage } = window
    localStorage.setItem(testData, testData)
    localStorage.getItem(testData)
    localStorage.removeItem(testData)
  } catch {
    return false
  }
  return true
}

/** Generate an RFC 4122 version 4 UUID using the browser's cryptographic RNG. */
export function generateUuid(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  // RFC 4122 version 4 (random) and IETF variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, byte =>
    byte.toString(16).padStart(2, "0")
  ).join("")
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-")
}

type DeviceType =
  | "mobile"
  | "tablet"
  | "smarttv"
  | "wearable"
  | "embedded"
  | "console"

interface UserAgentInfo {
  browserName?: string
  browserVersion?: string
  deviceType?: DeviceType
  os?: string
}

/**
 * Browser tokens to match, in priority order. Many browsers also include
 * Chrome or Safari in their user agent string, so more specific browsers
 * must come first.
 */
const BROWSER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Edge", pattern: /(?:EdgA|EdgiOS|Edg)\/([\d.]+)/i },
  { name: "Opera", pattern: /(?:OPR|Opera)\/([\d.]+)/i },
  { name: "Samsung Internet", pattern: /SamsungBrowser\/([\d.]+)/i },
  { name: "UCBrowser", pattern: /(?:UCBrowser|UC Browser)\/([\d.]+)/i },
  { name: "QQBrowser", pattern: /MQQBrowser\/([\d.]+)/i },
  { name: "Maxthon", pattern: /Maxthon\/([\d.]+)/i },
  { name: "IE", pattern: /MSIE\s([\d.]+)/i },
  { name: "IE", pattern: /Trident\/.*?rv:([\d.]+)/i },
  { name: "Chrome", pattern: /(?:CriOS|Chrome)\/([\d.]+)/i },
  { name: "Firefox", pattern: /(?:FxiOS|Firefox)\/([\d.]+)/i },
]

/** Ordered OS tokens; earlier entries win when several could match. */
const OS_PATTERNS: Array<{ os: string; pattern: RegExp }> = [
  { os: "iOS", pattern: /(?:iPhone|iPad|iPod)/i },
  { os: "Windows Phone", pattern: /Windows Phone/i },
  { os: "Windows", pattern: /Windows/i },
  { os: "Android", pattern: /Android/i },
  { os: "Chromium OS", pattern: /CrOS/i },
  { os: "Mac OS", pattern: /(?:Macintosh|Mac OS X)/i },
  { os: "Ubuntu", pattern: /Ubuntu/i },
  { os: "Linux", pattern: /Linux/i },
]

/**
 * Parse the browser, device class, and operating system fields Streamlit uses.
 * Names intentionally mirror ua-parser-js so historical telemetry stays comparable.
 */
export function parseUserAgent(userAgent: string): UserAgentInfo {
  let browserName: string | undefined
  let browserVersion: string | undefined

  for (const { name, pattern } of BROWSER_PATTERNS) {
    const match = pattern.exec(userAgent)
    if (match?.[1]) {
      browserName = name
      browserVersion = match[1]
      break
    }
  }

  // Safari has no unique product token, so identify it only after more
  // specific browsers (Chrome, Edge, etc.) have failed to match.
  if (!browserName && /Safari\//i.test(userAgent)) {
    const safariVersion = /Version\/([\d.]+)/i.exec(userAgent)?.[1]
    if (safariVersion) {
      browserName = /(?:iPhone|iPad|iPod)/i.test(userAgent)
        ? "Mobile Safari"
        : "Safari"
      browserVersion = safariVersion
    }
  }

  let deviceType: DeviceType | undefined
  if (/(?:SMART-TV|SmartTV|Tizen|Web0S|webOS)/i.test(userAgent)) {
    deviceType = "smarttv"
  } else if (/(?:watchOS|Watch OS|Wear OS|Galaxy Watch)/i.test(userAgent)) {
    deviceType = "wearable"
  } else if (/(?:Xbox|PlayStation|Nintendo)/i.test(userAgent)) {
    deviceType = "console"
  } else if (/(?:CrKey|Chromecast)/i.test(userAgent)) {
    deviceType = "embedded"
  } else if (
    /(?:iPad|Tablet|PlayBook|Silk\/)/i.test(userAgent) ||
    // Android tablets typically omit "Mobile", which phones include.
    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))
  ) {
    deviceType = "tablet"
  } else if (
    /(?:Mobi|iPhone|iPod|Windows Phone|IEMobile|Opera Mini)/i.test(userAgent)
  ) {
    deviceType = "mobile"
  }

  const os = OS_PATTERNS.find(({ pattern }) => pattern.test(userAgent))?.os

  return { browserName, browserVersion, deviceType, os }
}
