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

import { mockEndpoints } from "~lib/mocks/mocks"

import { handleFavicon } from "./Favicon"

function getFaviconHref(): string {
  const faviconElement: HTMLLinkElement | null = document.querySelector(
    "link[rel='shortcut icon']"
  )
  return faviconElement ? faviconElement.href : ""
}

document.head.innerHTML = `<link rel="shortcut icon" href="default.png">`

const FLAG_MATERIAL_ICON_URL =
  "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/flag/default/24px.svg"

const SMART_DISPLAY_MATERIAL_ICON_URL =
  "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/smart_display/default/24px.svg"

const ACCESSIBILITY_NEW_MATERIAL_ICON_URL =
  "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/accessibility_new/default/24px.svg"

test("is set up with the default favicon", () => {
  expect(getFaviconHref()).toBe("http://localhost:3000/default.png")
})

describe("Favicon element", () => {
  const buildMediaURL = vi.fn().mockReturnValue("https://mock.media.url")
  const endpoints = mockEndpoints({ buildMediaURL: buildMediaURL })

  it("sets the favicon in the DOM", async () => {
    handleFavicon("https://some/random/favicon.png", vi.fn(), endpoints)
    // Wait for async operation to complete
    await vi.waitFor(() => {
      expect(buildMediaURL).toHaveBeenCalledWith(
        "https://some/random/favicon.png"
      )
      expect(getFaviconHref()).toBe("https://mock.media.url/")
    })
  })

  it("accepts emojis directly", async () => {
    handleFavicon("emoji:🍕", vi.fn(), endpoints)
    // Wait for async operation to complete
    await vi.waitFor(() => {
      // Check that its an svg that contains the pizza emoji bytecode:
      expect(getFaviconHref()).toContain("svg")
      expect(getFaviconHref()).toContain("%F0%9F%8D%95")
    })
  })

  it("handles emoji variants correctly", async () => {
    handleFavicon("emoji:🛰", vi.fn(), endpoints)
    // Wait for async operation to complete
    await vi.waitFor(() => {
      // Check that its an svg that contains the satellite emoji bytecode:
      expect(getFaviconHref()).toContain("svg")
      expect(getFaviconHref()).toContain("%F0%9F%9B%B0")
    })
  })

  it("handles material icon correctly", async () => {
    handleFavicon(":material/flag:", vi.fn(), endpoints)
    await vi.waitFor(() => {
      expect(getFaviconHref()).toBe(FLAG_MATERIAL_ICON_URL)
    })

    handleFavicon(":material/smart_display:", vi.fn(), endpoints)
    await vi.waitFor(() => {
      expect(getFaviconHref()).toBe(SMART_DISPLAY_MATERIAL_ICON_URL)
    })

    handleFavicon(":material/accessibility_new:", vi.fn(), endpoints)
    await vi.waitFor(() => {
      expect(getFaviconHref()).toBe(ACCESSIBILITY_NEW_MATERIAL_ICON_URL)
    })
  })

  it("handles emoji shortcodes containing a dash correctly", async () => {
    handleFavicon(":crescent-moon:", vi.fn(), endpoints)
    // Wait for async operation to complete
    await vi.waitFor(() => {
      // Check that its an svg that contains the crescent moon emoji bytecode:
      expect(getFaviconHref()).toContain("svg")
      expect(getFaviconHref()).toContain("%F0%9F%8C%99")
    })
  })

  it("accepts emoji shortcodes", async () => {
    handleFavicon(":pizza:", vi.fn(), endpoints)
    // Wait for async operation to complete
    await vi.waitFor(() => {
      // Check that its an svg that contains the pizza emoji bytecode:
      expect(getFaviconHref()).toContain("svg")
      expect(getFaviconHref()).toContain("%F0%9F%8D%95")
    })
  })

  it("updates the favicon when it changes", async () => {
    handleFavicon("/media/1234567890.png", vi.fn(), endpoints)
    await vi.waitFor(() => {
      expect(getFaviconHref()).toBe("https://mock.media.url/")
    })

    handleFavicon(":pizza:", vi.fn(), endpoints)
    // Wait for async operation to complete
    await vi.waitFor(() => {
      // Check that its an svg that contains the pizza emoji bytecode:
      expect(getFaviconHref()).toContain("svg")
      expect(getFaviconHref()).toContain("%F0%9F%8D%95")
    })
  })

  it("sends SET_PAGE_FAVICON message to host", async () => {
    const sendMessageToHost = vi.fn()
    handleFavicon(
      "https://streamlit.io/path/to/favicon.png",
      sendMessageToHost,
      endpoints
    )
    await vi.waitFor(() => {
      expect(sendMessageToHost).toHaveBeenCalledWith({
        favicon: "https://mock.media.url",
        type: "SET_PAGE_FAVICON",
      })
    })
  })

  describe("emoji handling", () => {
    it.each([
      ["emoji:😀", "%F0%9F%98%80"],
      ["emoji:🚀", "%F0%9F%9A%80"],
      ["emoji:🍕", "%F0%9F%8D%95"],
      ["emoji:⭐", "%E2%AD%90"],
      ["emoji:🎮", "%F0%9F%8E%AE"],
      ["emoji:🛰️", "%F0%9F%9B%B0"],
    ])("handles basic emojis - %s", async (favicon, expectedEncodedEmoji) => {
      handleFavicon(favicon, vi.fn(), endpoints)
      await vi.waitFor(() => {
        expect(getFaviconHref()).toContain("svg")
        expect(getFaviconHref()).toContain(expectedEncodedEmoji)
      })
    })

    it.each([
      [":smile:", "%F0%9F%98%84"], // 😄
      [":rocket:", "%F0%9F%9A%80"], // 🚀
      [":pizza:", "%F0%9F%8D%95"], // 🍕
      [":star:", "%E2%AD%90"], // ⭐
      [":video_game:", "%F0%9F%8E%AE"], // 🎮
    ])(
      "handles emoji shortcodes - %s",
      async (favicon, expectedEncodedEmoji) => {
        handleFavicon(favicon, vi.fn(), endpoints)
        await vi.waitFor(() => {
          expect(getFaviconHref()).toContain("svg")
          expect(getFaviconHref()).toContain(expectedEncodedEmoji)
        })
      }
    )

    it.each([
      [":crescent-moon:", "%F0%9F%8C%99"], // 🌙
      [":lying-face:", "%F0%9F%A4%A5"], // 🤥
    ])(
      "handles shortcodes with dashes - %s",
      async (favicon, expectedEncodedEmoji) => {
        handleFavicon(favicon, vi.fn(), endpoints)
        await vi.waitFor(() => {
          expect(getFaviconHref()).toContain("svg")
          expect(getFaviconHref()).toContain(expectedEncodedEmoji)
        })
      }
    )

    it.each([
      ["emoji:👍🏻", "%F0%9F%91%8D%F0%9F%8F%BB"], // light skin tone
      ["emoji:👍🏽", "%F0%9F%91%8D%F0%9F%8F%BD"], // medium skin tone
      ["emoji:👍🏿", "%F0%9F%91%8D%F0%9F%8F%BF"], // dark skin tone
    ])(
      "handles skin tone modifiers - %s",
      async (favicon, expectedEncodedEmoji) => {
        handleFavicon(favicon, vi.fn(), endpoints)
        await vi.waitFor(() => {
          expect(getFaviconHref()).toContain("svg")
          expect(getFaviconHref()).toContain(expectedEncodedEmoji)
        })
      }
    )

    it.each([
      ["emoji:🪣", "%F0%9F%AA%A3"], // bucket (added in 2020)
      ["emoji:🥹", "%F0%9F%A5%B9"], // face holding back tears (added in 2022)
      ["emoji:🫠", "%F0%9F%AB%A0"], // melting face (added in 2022)
      ["emoji:🫥", "%F0%9F%AB%A5"], // dotted line face (added in 2022)
      ["emoji:🐦‍🔥", "svg"], // Phoenix (added in 2023) - complex ZWJ sequence
      ["emoji:🍋‍🟩", "svg"], // lime (added in 2023) - complex ZWJ sequence
    ])("handles newer emojis - %s", async (favicon, expectedContent) => {
      handleFavicon(favicon, vi.fn(), endpoints)
      await vi.waitFor(() => {
        expect(getFaviconHref()).toContain("svg")
        expect(getFaviconHref()).toContain(expectedContent)
      })
    })

    it.each([
      ["emoji:😀", "%F0%9F%98%80"], // grinning face (2015)
      ["emoji:👨‍👩‍👦", "svg"], // family (2016) - ZWJ sequence
      ["emoji:💩", "%F0%9F%92%A9"], // pile of poo (2010)
      ["emoji:♥️", "svg"], // heart symbol (very early emoji)
    ])("handles older emojis - %s", async (favicon, expectedContent) => {
      handleFavicon(favicon, vi.fn(), endpoints)
      await vi.waitFor(() => {
        expect(getFaviconHref()).toContain("svg")
        expect(getFaviconHref()).toContain(expectedContent)
      })
    })

    it.each([
      ["emoji:👨‍💻", "svg"], // man technologist - ZWJ sequence
      ["emoji:👩‍🚒", "svg"], // woman firefighter - ZWJ sequence
      ["emoji:👨‍👨‍👧‍👧", "svg"], // family with two men and two girls - complex ZWJ
      [":woman_technologist:", "%F0%9F%91%A9"], // 👩‍💻
    ])("handles compound emojis - %s", async (favicon, expectedContent) => {
      handleFavicon(favicon, vi.fn(), endpoints)
      await vi.waitFor(() => {
        expect(getFaviconHref()).toContain("svg")
        expect(getFaviconHref()).toContain(expectedContent)
      })
    })

    it.each([
      ["emoji:🇺🇸", "%F0%9F%87%BA%F0%9F%87%B8"], // 🇺🇸
      ["emoji:🇯🇵", "%F0%9F%87%AF%F0%9F%87%B5"], // 🇯🇵
      ["emoji:🇪🇸", "%F0%9F%87%AA%F0%9F%87%B8"], // 🇪🇸
      [":brazil:", "%F0%9F%87%A7%F0%9F%87%B7"], // 🇧🇷
    ])("handles flags - %s", async (favicon, expectedEncodedEmoji) => {
      handleFavicon(favicon, vi.fn(), endpoints)
      await vi.waitFor(() => {
        expect(getFaviconHref()).toContain("svg")
        expect(getFaviconHref()).toContain(expectedEncodedEmoji)
      })
    })

    it.each([[":invalid_emoji_code:"], ["hello"], ["12345"], ["::"], [":"]])(
      "treats non-emoji strings as URLs - %s",
      async favicon => {
        handleFavicon(favicon, vi.fn(), endpoints)
        await vi.waitFor(() => {
          expect(buildMediaURL).toHaveBeenCalledWith(favicon)
          expect(getFaviconHref()).toBe("https://mock.media.url/")
        })
      }
    )
  })
})
