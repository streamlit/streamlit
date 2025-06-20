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

import { MockInstance } from "vitest"

import getBrowserInfo from "./getBrowserInfo"

describe("getBrowserInfo", () => {
  let userAgentSpy: MockInstance

  const mockUserAgent = (userAgentString: string): void => {
    userAgentSpy = vi
      .spyOn(window.navigator, "userAgent", "get")
      .mockReturnValue(userAgentString)
  }

  afterEach(() => {
    userAgentSpy.mockRestore()
  })

  it("should detect Opera browser on Windows", () => {
    mockUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 OPR/77.0.4054.254"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Opera",
      browserVersion: "77.0.4054.254",
      deviceType: "desktop",
      os: "Windows",
    })
  })

  it("should detect Brave browser on macOS", () => {
    mockUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 Brave/92.0.4515.107"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Brave",
      browserVersion: "92.0.4515.107",
      deviceType: "desktop",
      os: "Mac OS",
    })
  })

  it("should detect QQ Browser on Android", () => {
    mockUserAgent(
      "Mozilla/5.0 (Linux; U; Android 10; en-US; V2023A Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36 MQQBrowser/13.4 Mobile"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "QQBrowser",
      browserVersion: "13.4",
      deviceType: "mobile",
      os: "Android",
    })
  })

  it("should detect Internet Explorer on Windows", () => {
    mockUserAgent(
      "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "IE",
      browserVersion: "11.0",
      deviceType: "desktop",
      os: "Windows",
    })
  })

  it("should detect Maxthon browser on Windows", () => {
    mockUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:65.0) Gecko/20100101 Firefox/65.0 Maxthon/6.1.0.2000"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Maxthon",
      browserVersion: "6.1.0.2000",
      deviceType: "desktop",
      os: "Windows",
    })
  })

  it("should detect Chrome on Chrome OS", () => {
    mockUserAgent(
      "Mozilla/5.0 (X11; CrOS x86_64 13421.99.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Chrome",
      browserVersion: "91.0.4472.114",
      deviceType: "desktop",
      os: "Chromium OS",
    })
  })

  it("should detect UC Browser on Android", () => {
    mockUserAgent(
      "Mozilla/5.0 (Linux; Android 9; M2004J19C) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 UCBrowser/13.0.0.1288 Mobile Safari/537.36"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "UCBrowser",
      browserVersion: "13.0.0.1288",
      deviceType: "mobile",
      os: "Android",
    })
  })

  it("should detect Samsung Internet on Android", () => {
    mockUserAgent(
      "Mozilla/5.0 (Linux; Android 10; SAMSUNG SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/13.2 Chrome/79.0.3945.136 Mobile Safari/537.36"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Samsung Internet",
      browserVersion: "13.2",
      deviceType: "mobile",
      os: "Android",
    })
  })

  it("should detect Safari browser on macOS", () => {
    mockUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Safari",
      browserVersion: "14.0",
      deviceType: "desktop",
      os: "Mac OS",
    })
  })

  it("should detect Safari browser on iOS", () => {
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Mobile Safari",
      browserVersion: "14.0",
      deviceType: "mobile",
      os: "iOS",
    })
  })

  it("should detect Chrome browser on iOS", () => {
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.114 Mobile/15E148 Safari/604.1"
    )

    const result = getBrowserInfo()
    expect(result).toEqual({
      browserName: "Chrome",
      browserVersion: "91.0.4472.114",
      deviceType: "mobile",
      os: "iOS",
    })
  })
})
