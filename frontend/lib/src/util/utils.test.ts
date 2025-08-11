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

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from "vitest"

import {
  EMBED_QUERY_PARAM_KEY,
  EMBED_QUERY_PARAM_VALUES,
  getEmbedUrlParams,
  getLoadingScreenType,
  getSelectPlaceholder,
  getUrl,
  isDarkThemeInQueryParams,
  isEmbed,
  isInChildFrame,
  isLightThemeInQueryParams,
  isPaddingDisplayed,
  isScrollingHidden,
  isToolbarDisplayed,
  keysToSnakeCase,
  LoadingScreenType,
  preserveEmbedQueryParams,
  setCookie,
} from "./utils"

describe("setCookie", () => {
  afterEach(() => {
    /*
      Setting a cookie with document.cookie = "key=value" will append or modify "key"
      with "value". It does not overwrite the existing list of cookies in document.cookie.
      In order to delete the cookie, give the cookie an expiration date that has passed.
      This cleanup ensures that we delete all cookies after each test.
    */
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`
    })
  })

  it("set new cookie", () => {
    setCookie("flavor", "chocolatechip")
    expect(document.cookie).toEqual("flavor=chocolatechip")
  })

  it("update existing cookie", () => {
    document.cookie = "flavor=chocolatechip"
    setCookie("flavor", "sugar")
    expect(document.cookie).toEqual("flavor=sugar")
  })

  it("remove cookie", () => {
    document.cookie = "flavor=chocolatechip"
    setCookie("flavor")
    expect(document.cookie).toEqual("")
  })
})

describe("embedParamValues", () => {
  const embedParamValuesShouldHave = [
    "show_toolbar",
    "show_padding",
    "disable_scrolling",
    "light_theme",
    "dark_theme",
    "hide_loading_screen",
    "show_loading_screen_v1",
    "show_loading_screen_v2",
    "true",
  ]
  it("embedParamValues have correct values", () => {
    expect(EMBED_QUERY_PARAM_VALUES.length).toBe(
      embedParamValuesShouldHave.length
    )
    embedParamValuesShouldHave.forEach(value => {
      expect(EMBED_QUERY_PARAM_VALUES.includes(value.toLowerCase())).toBe(true)
    })
  })
})

describe("getEmbedUrlParams", () => {
  let windowSpy: MockInstance

  beforeEach(() => {
    windowSpy = vi.spyOn(window, "window", "get")
  })

  afterEach(() => {
    windowSpy.mockRestore()
  })

  it("getEmbedUrlParams should contain true when ?embed=true", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=true",
      },
    }))
    expect(getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).has("true")).toBe(true)
  })

  it("getEmbedUrlParams should contain true when ?EMBED=TRUE", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?EMBED=TRUE",
      },
    }))
    expect(getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).has("true")).toBe(true)
  })

  it("getEmbedUrlParams is case insensitive, should contain true when ?EmBeD=TrUe", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?EmBeD=TrUe",
      },
    }))
    expect(getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).has("true")).toBe(true)
  })

  it("getEmbedUrlParams is empty, when params are invalid", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=no&embed=text&embed=zero",
      },
    }))
    expect(getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).size).toBe(0)
  })

  it("getEmbedUrlParams is empty, when there is no query string", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "",
      },
    }))
    expect(getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).size).toBe(0)
  })

  it("getEmbedUrlParams is empty, when there is query string without embed param", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?text=a&x=b&c=a",
      },
    }))
    expect(getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).size).toBe(0)
  })

  it("getEmbedUrlParams with EMBED_QUERY_PARAM_KEY reads only ?embed param", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=true&embed=true&a=x",
      },
    }))
    expect(getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).size).toBe(1)
  })
})

describe("isEmbed", () => {
  let windowSpy: MockInstance

  beforeEach(() => {
    windowSpy = vi.spyOn(window, "window", "get")
  })

  afterEach(() => {
    windowSpy.mockRestore()
  })

  it("isEmbed should return true when ?embed=true", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=true",
      },
    }))
    expect(isEmbed()).toBe(true)
  })

  it("isEmbed should return true when ?embed=TRUE", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=TRUE",
      },
    }))
    expect(isEmbed()).toBe(true)
  })

  it("embed Options should return false even if ?embed=true", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=true",
      },
    }))

    expect(isToolbarDisplayed()).toBe(false)
    expect(isPaddingDisplayed()).toBe(false)
    expect(isScrollingHidden()).toBe(false)
    expect(isLightThemeInQueryParams()).toBe(false)
    expect(isDarkThemeInQueryParams()).toBe(false)
  })

  it("embed Options should return false even if ?embed=false", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search:
          "?embed=false&embed_options=show_colored_line,show_toolbar,show_padding,disable_scrolling",
      },
    }))

    expect(isToolbarDisplayed()).toBe(false)
    expect(isPaddingDisplayed()).toBe(false)
    expect(isScrollingHidden()).toBe(false)
  })

  it("embed Options should return false even if ?embed is not set", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search:
          "?embed_options=show_colored_line,show_toolbar,show_padding,disable_scrolling",
      },
    }))

    expect(isToolbarDisplayed()).toBe(false)
    expect(isPaddingDisplayed()).toBe(false)
    expect(isScrollingHidden()).toBe(false)
  })

  it("should specify light theme if in embed options", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed_options=light_theme",
      },
    }))

    expect(isLightThemeInQueryParams()).toBe(true)
  })

  it("should specify dark theme if in embed options", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed_options=dark_theme",
      },
    }))

    expect(isDarkThemeInQueryParams()).toBe(true)
  })

  it("should disable scrolling if in embed options", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=true&embed_options=disable_scrolling",
      },
    }))

    expect(isToolbarDisplayed()).toBe(false)
    expect(isPaddingDisplayed()).toBe(false)
    expect(isScrollingHidden()).toBe(true)
    expect(isLightThemeInQueryParams()).toBe(false)
    expect(isDarkThemeInQueryParams()).toBe(false)
  })

  it("should show padding if in embed options", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=true&embed_options=show_padding",
      },
    }))

    expect(isToolbarDisplayed()).toBe(false)
    expect(isPaddingDisplayed()).toBe(true)
    expect(isScrollingHidden()).toBe(false)
    expect(isLightThemeInQueryParams()).toBe(false)
    expect(isDarkThemeInQueryParams()).toBe(false)
  })

  it("should show the toolbar if in embed options", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=true&embed_options=show_toolbar",
      },
    }))

    expect(isToolbarDisplayed()).toBe(true)
    expect(isPaddingDisplayed()).toBe(false)
    expect(isScrollingHidden()).toBe(false)
    expect(isLightThemeInQueryParams()).toBe(false)
    expect(isDarkThemeInQueryParams()).toBe(false)
  })

  it("isEmbed is case insensitive, so should return true when ?embed=TrUe", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?EmBeD=TrUe",
      },
    }))
    expect(isEmbed()).toBe(true)
  })

  it("isEmbed returns true, when there is at least one occurrence of ?embed=true", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed=text&embed=true",
      },
    }))
    expect(isEmbed()).toBe(true)
  })

  it("isEmbed returns false, when no url param is set", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "",
      },
    }))
    expect(isEmbed()).toBe(false)
  })

  it("isEmbed returns false when embed url param is any string other than true", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "randomText",
      },
    }))
    expect(isEmbed()).toBe(false)
  })
})

describe("getLoadingScreenType", () => {
  it("should return v2 by default", () => {
    vi.stubGlobal("window", {
      location: {
        search: null,
      },
    })

    expect(getLoadingScreenType()).toBe(LoadingScreenType.V2)
  })

  it("should give precedence to 'hide'", () => {
    vi.stubGlobal("window", {
      location: {
        search:
          "?embed_options=hide_loading_screen&show_loading_screen_v1&show_loading_screen_v2",
      },
    })

    expect(getLoadingScreenType()).toBe(LoadingScreenType.NONE)
  })

  it("should support 'hide'", () => {
    vi.stubGlobal("window", {
      location: {
        search: "?embed_options=hide_loading_screen",
      },
    })

    expect(getLoadingScreenType()).toBe(LoadingScreenType.NONE)
  })

  it("should support 'v1'", () => {
    vi.stubGlobal("window", {
      location: {
        search: "?embed_options=show_loading_screen_v1",
      },
    })

    expect(getLoadingScreenType()).toBe(LoadingScreenType.V1)
  })

  it("should support 'v2'", () => {
    vi.stubGlobal("window", {
      location: {
        search: "?embed_options=show_loading_screen_v2",
      },
    })

    expect(getLoadingScreenType()).toBe(LoadingScreenType.V2)
  })

  describe("preserveEmbedQueryParams", () => {
    let prevWindowLocation: Location

    beforeEach(() => {
      prevWindowLocation = window.location
    })

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: prevWindowLocation,
        writable: true,
        configurable: true,
      })
    })

    it("should return an empty string if not in embed mode", () => {
      Object.defineProperty(window, "location", {
        value: {
          assign: vi.fn(),
          search: "foo=bar",
        },
        writable: true,
        configurable: true,
      })
      expect(preserveEmbedQueryParams()).toBe("")
    })

    it("should preserve embed query string even with no embed options and remove foo=bar", () => {
      Object.defineProperty(window, "location", {
        value: {
          assign: vi.fn(),
          search: "embed=true&foo=bar",
        },
        writable: true,
        configurable: true,
      })
      expect(preserveEmbedQueryParams()).toBe("embed=true")
    })

    it("should preserve embed query string with embed options and remove foo=bar", () => {
      Object.defineProperty(window, "location", {
        value: {
          assign: vi.fn(),
          search:
            "embed=true&embed_options=option1&embed_options=option2&foo=bar",
        },
        writable: true,
        configurable: true,
      })
      expect(preserveEmbedQueryParams()).toBe(
        "embed=true&embed_options=option1&embed_options=option2"
      )
    })
  })
})

describe("keysToSnakeCase", () => {
  it("should replace . with _", () => {
    expect(keysToSnakeCase({ "marker.size": "bob" })).toEqual({
      marker_size: "bob",
    })
  })

  it("should return decamelized keys for regular keys", () => {
    expect(keysToSnakeCase({ aliceName: "alice", bobName: "bob" })).toEqual({
      alice_name: "alice",
      bob_name: "bob",
    })
  })

  it("should return an empty dictionary when passed an empty dictionary", () => {
    expect(keysToSnakeCase({})).toEqual({})
  })
})

// Mock isInChildFrame since getUrl depends on it
vi.mock("./utils", async importOriginal => {
  const actual = await importOriginal<typeof import("./utils")>()
  return {
    ...actual,
    isInChildFrame: vi.fn(),
  }
})

describe("getUrl", () => {
  const mockIsInChildFrame = vi.mocked(isInChildFrame)
  let topSpy: MockInstance<() => unknown>
  let documentSpy: MockInstance<() => unknown>

  beforeEach(() => {
    documentSpy = vi.spyOn(global, "document", "get")
    topSpy = vi.spyOn(global, "top", "get")

    // Reset mocks
    mockIsInChildFrame.mockReset()
    documentSpy.mockReset()
    topSpy.mockReset()
  })

  afterEach(() => {
    // Restore original implementations
    vi.restoreAllMocks()
  })

  it("should return document.location.href without query params when not in an iframe", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main?param=value",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main")
  })

  it("should return document.location.href without query params when in an iframe but window.top access throws error", () => {
    mockIsInChildFrame.mockReturnValue(true)

    // Simulate error when accessing top getter
    topSpy.mockImplementation(() => {
      throw new Error("CSP error simulation")
    })

    // Mock document location for the fallback
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://iframe.com/page?iframeparam=1",
      },
    }))

    expect(getUrl()).toBe("http://iframe.com/page")
  })

  it("should handle URLs with no query parameters correctly", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main")
  })

  it("should handle URLs ending with / correctly", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main/?query=1",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main/")
  })

  it("should handle complex query parameters correctly", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main?foo=bar&baz=qux&embed=true",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main")
  })

  it("should return document.location.href without query params or anchors when not in an iframe", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main?param=value#section",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main")
  })

  it("should return document.location.href without query params or anchors when in an iframe but window.top access throws error", () => {
    mockIsInChildFrame.mockReturnValue(true)

    // Simulate error when accessing top getter
    topSpy.mockImplementation(() => {
      throw new Error("CSP error simulation")
    })

    // Mock document location for the fallback
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://iframe.com/page?iframeparam=1#top",
      },
    }))

    expect(getUrl()).toBe("http://iframe.com/page")
  })

  it("should handle URLs with only an anchor correctly", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main#section",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main")
  })

  it("should handle URLs ending with / and an anchor correctly", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main/#section?query=1",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main/")
  })

  it("should handle complex query parameters and an anchor correctly", () => {
    mockIsInChildFrame.mockReturnValue(false)
    documentSpy.mockImplementation(() => ({
      location: {
        href: "http://localhost:3000/main?foo=bar&baz=qux&embed=true#section",
      },
    }))

    expect(getUrl()).toBe("http://localhost:3000/main")
  })
})

describe("getSelectPlaceholder", () => {
  describe("single-select mode", () => {
    it("returns custom placeholder when provided", () => {
      const result = getSelectPlaceholder(
        "Custom placeholder",
        ["option1", "option2"],
        true,
        false
      )
      expect(result.placeholder).toBe("Custom placeholder")
      expect(result.shouldDisable).toBe(false)
    })

    it("returns 'No options to select' and disables when no options and no new options allowed", () => {
      const result = getSelectPlaceholder("", [], false, false)
      expect(result.placeholder).toBe("No options to select")
      expect(result.shouldDisable).toBe(true)
    })

    it("returns 'Add an option' when no options but new options allowed", () => {
      const result = getSelectPlaceholder("", [], true, false)
      expect(result.placeholder).toBe("Add an option")
      expect(result.shouldDisable).toBe(false)
    })

    it("returns 'Choose an option' when options exist and no new options allowed", () => {
      const result = getSelectPlaceholder("", ["option1"], false, false)
      expect(result.placeholder).toBe("Choose an option")
      expect(result.shouldDisable).toBe(false)
    })

    it("returns 'Choose or add an option' when options exist and new options allowed", () => {
      const result = getSelectPlaceholder("", ["option1"], true, false)
      expect(result.placeholder).toBe("Choose or add an option")
      expect(result.shouldDisable).toBe(false)
    })
  })

  describe("multi-select mode", () => {
    it("returns custom placeholder when provided", () => {
      const result = getSelectPlaceholder(
        "Custom placeholder",
        ["option1", "option2"],
        true,
        true
      )
      expect(result.placeholder).toBe("Custom placeholder")
      expect(result.shouldDisable).toBe(false)
    })

    it("returns 'No options to select' and disables when no options and no new options allowed", () => {
      const result = getSelectPlaceholder("", [], false, true)
      expect(result.placeholder).toBe("No options to select")
      expect(result.shouldDisable).toBe(true)
    })

    it("returns 'Add options' when no options but new options allowed", () => {
      const result = getSelectPlaceholder("", [], true, true)
      expect(result.placeholder).toBe("Add options")
      expect(result.shouldDisable).toBe(false)
    })

    it("returns 'Choose options' when options exist and no new options allowed", () => {
      const result = getSelectPlaceholder("", ["option1"], false, true)
      expect(result.placeholder).toBe("Choose options")
      expect(result.shouldDisable).toBe(false)
    })

    it("returns 'Choose or add options' when options exist and new options allowed", () => {
      const result = getSelectPlaceholder("", ["option1"], true, true)
      expect(result.placeholder).toBe("Choose or add options")
      expect(result.shouldDisable).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("handles single space placeholder as custom placeholder", () => {
      const result = getSelectPlaceholder(" ", ["option1"], true, false)
      expect(result.placeholder).toBe(" ")
      expect(result.shouldDisable).toBe(false)
    })
  })
})
