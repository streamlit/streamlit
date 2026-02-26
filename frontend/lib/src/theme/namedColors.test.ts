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
  BACKGROUND_ONLY_COLORS,
  isNamedColor,
  NAMED_COLOR_CONFIG,
  NAMED_COLORS,
  NamedColor,
} from "./namedColors"

describe("namedColors", () => {
  describe("NAMED_COLOR_CONFIG", () => {
    it("contains all standard color names", () => {
      const expectedColors = [
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "violet",
        "gray",
        "grey",
        "primary",
      ]
      expectedColors.forEach(color => {
        expect(NAMED_COLOR_CONFIG).toHaveProperty(color)
      })
    })

    it("each entry has colorKey property", () => {
      Object.entries(NAMED_COLOR_CONFIG).forEach(([_name, config]) => {
        expect(config).toHaveProperty("colorKey")
        expect(typeof config.colorKey).toBe("string")
      })
    })

    it("each entry has bgColorKey property (string or null)", () => {
      Object.entries(NAMED_COLOR_CONFIG).forEach(([_name, config]) => {
        expect(config).toHaveProperty("bgColorKey")
        expect(
          config.bgColorKey === null || typeof config.bgColorKey === "string"
        ).toBe(true)
      })
    })

    it("grey is an alias for gray", () => {
      expect(NAMED_COLOR_CONFIG.grey.colorKey).toBe(
        NAMED_COLOR_CONFIG.gray.colorKey
      )
      expect(NAMED_COLOR_CONFIG.grey.bgColorKey).toBe(
        NAMED_COLOR_CONFIG.gray.bgColorKey
      )
    })

    it("primary has null bgColorKey (computed separately)", () => {
      expect(NAMED_COLOR_CONFIG.primary.bgColorKey).toBeNull()
    })
  })

  describe("BACKGROUND_ONLY_COLORS", () => {
    it("contains purple (distinct from violet)", () => {
      expect(BACKGROUND_ONLY_COLORS).toHaveProperty("purple")
      expect(BACKGROUND_ONLY_COLORS.purple.bgColorKey).toBe("purplebg")
    })
  })

  describe("NAMED_COLORS", () => {
    it("is derived from NAMED_COLOR_CONFIG keys", () => {
      const configKeys = Object.keys(NAMED_COLOR_CONFIG)
      expect(NAMED_COLORS.size).toBe(configKeys.length)
      configKeys.forEach(key => {
        expect(NAMED_COLORS.has(key)).toBe(true)
      })
    })

    it("does not include background-only colors", () => {
      Object.keys(BACKGROUND_ONLY_COLORS).forEach(key => {
        expect(NAMED_COLORS.has(key)).toBe(false)
      })
    })
  })

  describe("NamedColor type", () => {
    it("accepts all config keys at compile time", () => {
      // This is a compile-time check - if it compiles, the type is correct
      const validColors: NamedColor[] = [
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "violet",
        "gray",
        "grey",
        "primary",
      ]
      expect(validColors).toHaveLength(Object.keys(NAMED_COLOR_CONFIG).length)
    })
  })

  describe("isNamedColor", () => {
    it.each([
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "violet",
      "gray",
      "grey",
      "primary",
    ])('returns true for "%s"', color => {
      expect(isNamedColor(color)).toBe(true)
    })

    it.each(["RED", "Red", "BLUE", "Blue", "PRIMARY", "Primary"])(
      'returns true for case-insensitive "%s"',
      color => {
        expect(isNamedColor(color)).toBe(true)
      }
    )

    it.each(["#ff0000", "rgb(255,0,0)", "pink", "cyan", "purple", "magenta"])(
      'returns false for non-builtin "%s"',
      color => {
        expect(isNamedColor(color)).toBe(false)
      }
    )

    it.each([null, undefined, 123, [], {}, true])(
      "returns false for non-string %p",
      value => {
        expect(isNamedColor(value)).toBe(false)
      }
    )
  })
})
