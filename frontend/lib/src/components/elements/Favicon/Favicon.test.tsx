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

import { mockEndpoints } from "@streamlit/lib/src/mocks/mocks"
import { getFaviconUrl, overwriteFavicon } from "./Favicon"

function getFaviconHref(): string {
  const faviconElement: HTMLLinkElement | null = document.querySelector(
    "link[rel='shortcut icon']"
  )
  return faviconElement ? faviconElement.href : ""
}

document.head.innerHTML = `<link rel="shortcut icon" href="default.png">`

const PIZZA_TWEMOJI_URL =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f355.png"
const SATELLITE_TWEMOJI_URL =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6f0.png"
const CRESCENT_MOON_TWEMOJI_URL =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f319.png"

test("is set up with the default favicon", () => {
  expect(getFaviconHref()).toBe("http://localhost/default.png")
})

describe("Favicon element", () => {
  const buildMediaURL = jest.fn().mockReturnValue("https://mock.media.url")
  const endpoints = mockEndpoints({ buildMediaURL: buildMediaURL })

  it("sets the favicon in the DOM", () => {
    getFaviconUrl("https://some/random/favicon.png", endpoints)
    expect(buildMediaURL).toHaveBeenCalledWith(
      "https://some/random/favicon.png"
    )
    overwriteFavicon("https://mock.media.url/")
    expect(getFaviconHref()).toBe("https://mock.media.url/")
  })

  it("accepts emojis directly", () => {
    getFaviconUrl("🍕", endpoints)
    overwriteFavicon(PIZZA_TWEMOJI_URL)
    expect(getFaviconHref()).toBe(PIZZA_TWEMOJI_URL)
  })

  it("handles emoji variants correctly", () => {
    getFaviconUrl("🛰", endpoints)
    overwriteFavicon(SATELLITE_TWEMOJI_URL)
    expect(getFaviconHref()).toBe(SATELLITE_TWEMOJI_URL)
  })

  it("handles emoji shortcodes containing a dash correctly", () => {
    getFaviconUrl(":crescent-moon:", endpoints)
    overwriteFavicon(CRESCENT_MOON_TWEMOJI_URL)
    expect(getFaviconHref()).toBe(CRESCENT_MOON_TWEMOJI_URL)
  })

  it("accepts emoji shortcodes", () => {
    getFaviconUrl(":pizza:", endpoints)
    overwriteFavicon(PIZZA_TWEMOJI_URL)
    expect(getFaviconHref()).toBe(PIZZA_TWEMOJI_URL)
  })

  it("updates the favicon when it changes", () => {
    getFaviconUrl("/media/1234567890.png", endpoints)
    getFaviconUrl(":pizza:", endpoints)
    overwriteFavicon(PIZZA_TWEMOJI_URL)
    expect(getFaviconHref()).toBe(PIZZA_TWEMOJI_URL)
  })
})
