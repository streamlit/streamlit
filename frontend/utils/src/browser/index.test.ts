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

import {
  generateUuid,
  getCookie,
  localStorageAvailable,
  parseUserAgent,
} from "."

describe("browser", () => {
  describe("localStorageAvailable", () => {
    // NOTE: localStorage is weird, and calling .spyOn(window.localStorage, "setItem")
    // doesn't work. Accessing .__proto__ here isn't too bad of a crime since
    // it's test code.
    const breakLocalStorage = (): void => {
      vi
        // eslint-disable-next-line no-proto
        .spyOn(window.localStorage.__proto__, "setItem")
        .mockImplementation(() => {
          throw new Error("boom")
        })
    }

    afterEach(() => {
      vi.restoreAllMocks()
      window.localStorage.clear()
    })

    it("returns false if a localStorage function explodes", () => {
      breakLocalStorage()
      expect(localStorageAvailable()).toBe(false)
    })

    it("returns true if all localStorage functions work", () => {
      expect(localStorageAvailable()).toBe(true)
    })
  })

  describe("getCookie", () => {
    afterEach(() => {
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=")
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`
      })
    })

    it("get existing cookie", () => {
      document.cookie = "flavor=chocolatechip"
      const cookie = getCookie("flavor")
      expect(cookie).toEqual("chocolatechip")
    })

    it("get missing cookie", () => {
      document.cookie = "sweetness=medium;"
      document.cookie = "flavor=chocolatechip;"
      document.cookie = "type=darkchocolate;"
      const cookie = getCookie("recipe")
      expect(cookie).toEqual(undefined)
    })

    it("find cookie in the front", () => {
      document.cookie = "flavor=chocolatechip;"
      document.cookie = "sweetness=medium;"
      document.cookie = "type=darkchocolate;"
      const cookie = getCookie("flavor")
      expect(cookie).toEqual("chocolatechip")
    })

    it("find cookie in the middle", () => {
      document.cookie = "sweetness=medium;"
      document.cookie = "flavor=chocolatechip;"
      document.cookie = "type=darkchocolate;"
      const cookie = getCookie("flavor")
      expect(cookie).toEqual("chocolatechip")
    })

    it("find cookie in the end", () => {
      document.cookie = "sweetness=medium;"
      document.cookie = "type=darkchocolate;"
      document.cookie = "flavor=chocolatechip;"
      const cookie = getCookie("flavor")
      expect(cookie).toEqual("chocolatechip")
    })
  })

  describe("generateUuid", () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it("uses crypto.randomUUID when available", () => {
      const uuid = "123e4567-e89b-42d3-a456-426614174000"
      vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(uuid)

      expect(generateUuid()).toBe(uuid)
    })

    it("generates a version 4 UUID with getRandomValues as a fallback", () => {
      vi.stubGlobal("crypto", {
        getRandomValues: (bytes: Uint8Array) => {
          bytes.fill(0xff)
          return bytes
        },
      })

      expect(generateUuid()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff")
    })
  })

  describe("parseUserAgent", () => {
    it.each([
      [
        "Android phone",
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/123.0 Mobile Safari/537.36",
        "mobile",
      ],
      [
        "Android tablet",
        "Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
        "tablet",
      ],
      [
        "Web0S TV",
        "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 DMOST/2.0.0 (; LGE; webOS TV)",
        "smarttv",
      ],
      [
        "legacy webOS TV",
        "Mozilla/5.0 (webOS/1.4.2; U; en-US) AppleWebKit/532.2 (KHTML, like Gecko) Version/1.0 Safari/532.2 Pre/1.1",
        "smarttv",
      ],
    ])("classifies an %s as %s", (_label, userAgent, deviceType) => {
      expect(parseUserAgent(userAgent).deviceType).toBe(deviceType)
    })

    it("prefers Edge over Chrome when both tokens are present", () => {
      expect(
        parseUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
        )
      ).toEqual({
        browserName: "Edge",
        browserVersion: "120.0.0.0",
        deviceType: undefined,
        os: "Windows",
      })
    })

    it("reports Ubuntu rather than Linux for Firefox on Ubuntu", () => {
      expect(
        parseUserAgent(
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"
        )
      ).toEqual({
        browserName: "Firefox",
        browserVersion: "121.0",
        deviceType: undefined,
        os: "Ubuntu",
      })
    })

    it("returns empty fields for an unknown user agent", () => {
      expect(parseUserAgent("custom-client")).toEqual({
        browserName: undefined,
        browserVersion: undefined,
        deviceType: undefined,
        os: undefined,
      })
    })
  })
})
