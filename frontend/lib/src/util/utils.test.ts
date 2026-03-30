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
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from "vitest"

import {
  ChatInput as ChatInputProto,
  Element,
  LabelVisibility as LabelVisibilityProto,
} from "@streamlit/protobuf"

import {
  AcceptFileValue,
  chatInputAcceptFileProtoValueToEnum,
  debounce,
  EMBED_QUERY_PARAM_KEY,
  EMBED_QUERY_PARAM_VALUES,
  extractPageNameFromPathName,
  generateUID,
  getElementId,
  getEmbeddingIdClassName,
  getEmbedUrlParams,
  getLoadingScreenType,
  getQueryString,
  getScreencastTimestamp,
  getSelectPlaceholder,
  getUrl,
  hashString,
  isDarkThemeInQueryParams,
  isEmbed,
  isFromMac,
  isFromWindows,
  isInChildFrame,
  isInForm,
  isLightThemeInQueryParams,
  isPaddingDisplayed,
  isScrollingHidden,
  isToolbarDisplayed,
  isValidElementId,
  isValidFormId,
  keysToSnakeCase,
  LabelVisibilityOptions,
  labelVisibilityProtoValueToEnum,
  LoadingScreenType,
  makeAppSkeletonElement,
  makeElementWithErrorText,
  makeElementWithInfoText,
  notUndefined,
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

  it("should preserve null values inside arrays without throwing", () => {
    const input = {
      customdata: [1, null, { innerKey: 5, anotherNull: null }],
    }

    expect(keysToSnakeCase(input)).toEqual({
      customdata: [1, null, { inner_key: 5, another_null: null }],
    })
  })

  it("should not attempt to recurse into null values", () => {
    const input = {
      value: null,
      array: [null],
      nested: { child: null },
    }

    expect(keysToSnakeCase(input)).toEqual({
      value: null,
      array: [null],
      nested: { child: null },
    })
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

describe("getScreencastTimestamp", () => {
  beforeEach(() => {
    // Set timezone to UTC for consistent test results across all environments
    process.env.TZ = "UTC"
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.TZ
  })

  it("should return a timestamp in the correct format", () => {
    vi.setSystemTime(new Date("2025-11-18T12:00:00.000Z"))
    expect(getScreencastTimestamp()).toBe("2025-11-18-12-00-00")
  })

  it("should handle single-digit months with proper padding", () => {
    vi.setSystemTime(new Date("2025-01-05T08:03:07.000Z"))
    expect(getScreencastTimestamp()).toBe("2025-01-05-08-03-07")
  })

  it("should handle single-digit days with proper padding", () => {
    vi.setSystemTime(new Date("2025-12-09T14:30:45.000Z"))
    expect(getScreencastTimestamp()).toBe("2025-12-09-14-30-45")
  })

  it("should handle single-digit hours with proper padding", () => {
    vi.setSystemTime(new Date("2025-06-15T03:25:50.000Z"))
    expect(getScreencastTimestamp()).toBe("2025-06-15-03-25-50")
  })

  it("should handle single-digit minutes with proper padding", () => {
    vi.setSystemTime(new Date("2025-07-20T18:05:30.000Z"))
    expect(getScreencastTimestamp()).toBe("2025-07-20-18-05-30")
  })

  it("should handle single-digit seconds with proper padding", () => {
    vi.setSystemTime(new Date("2025-08-25T23:45:09.000Z"))
    expect(getScreencastTimestamp()).toBe("2025-08-25-23-45-09")
  })

  it("should handle midnight correctly", () => {
    vi.setSystemTime(new Date("2025-03-10T00:00:00.000Z"))
    expect(getScreencastTimestamp()).toBe("2025-03-10-00-00-00")
  })

  it("should handle end of year correctly", () => {
    vi.setSystemTime(new Date("2024-12-31T23:59:59.000Z"))
    expect(getScreencastTimestamp()).toBe("2024-12-31-23-59-59")
  })

  it("should ignore milliseconds", () => {
    vi.setSystemTime(new Date("2025-05-15T10:20:30.999Z"))
    expect(getScreencastTimestamp()).toBe("2025-05-15-10-20-30")
  })
})

describe("getQueryString", () => {
  it.each([
    {
      queryStringOverride: undefined,
      preservedQueryParams: "embed=true",
      expected: "embed=true",
      description:
        "returns preservedQueryParams when queryStringOverride is undefined",
    },
    {
      queryStringOverride: undefined,
      preservedQueryParams: "",
      expected: "",
      description: "returns empty string when both are empty/undefined",
    },
    {
      queryStringOverride: "foo=bar",
      preservedQueryParams: "",
      expected: "foo=bar",
      description: "returns queryStringOverride when no preservedQueryParams",
    },
    {
      queryStringOverride: "foo=bar",
      preservedQueryParams: "embed=true",
      expected: "embed=true&foo=bar",
      description: "combines preservedQueryParams and queryStringOverride",
    },
    {
      queryStringOverride: "",
      preservedQueryParams: "embed=true",
      expected: "embed=true",
      description:
        "returns only preservedQueryParams when queryStringOverride is empty string",
    },
    {
      queryStringOverride: "page=1&sort=asc",
      preservedQueryParams: "embed=true&embed_options=dark",
      expected: "embed=true&embed_options=dark&page=1&sort=asc",
      description: "handles complex query strings",
    },
  ])(
    "$description",
    ({ queryStringOverride, preservedQueryParams, expected }) => {
      expect(getQueryString(queryStringOverride, preservedQueryParams)).toBe(
        expected
      )
    }
  )
})

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should call the function after the delay", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(100, fn)

    debouncedFn()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
  })

  it("should pass arguments to the debounced function", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(100, fn)

    debouncedFn("arg1", "arg2")
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledWith("arg1", "arg2")
  })

  it("should only call the function once when called multiple times within delay", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(100, fn)

    debouncedFn()
    debouncedFn()
    debouncedFn()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
  })

  it("should use the last call's arguments when called multiple times", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(100, fn)

    debouncedFn("first")
    debouncedFn("second")
    debouncedFn("third")

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith("third")
  })

  it("should reset the timer when called again within delay", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(100, fn)

    debouncedFn()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    debouncedFn()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledOnce()
  })
})

describe("hashString", () => {
  it("should return a consistent hash for the same input", () => {
    const hash1 = hashString("test")
    const hash2 = hashString("test")
    expect(hash1).toBe(hash2)
  })

  it("should return different hashes for different inputs", () => {
    const hash1 = hashString("test1")
    const hash2 = hashString("test2")
    expect(hash1).not.toBe(hash2)
  })

  it("should return a hexadecimal string", () => {
    const hash = hashString("test")
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it("should handle empty strings", () => {
    const hash = hashString("")
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })
})

describe("notUndefined", () => {
  it("should return true for defined values", () => {
    expect(notUndefined("test")).toBe(true)
    expect(notUndefined(0)).toBe(true)
    expect(notUndefined(null)).toBe(true)
    expect(notUndefined(false)).toBe(true)
  })

  it("should return false for undefined", () => {
    expect(notUndefined(undefined)).toBe(false)
  })
})

describe("isFromMac", () => {
  let navigatorSpy: MockInstance

  beforeEach(() => {
    navigatorSpy = vi.spyOn(navigator, "platform", "get")
  })

  afterEach(() => {
    navigatorSpy.mockRestore()
  })

  it("should return true on Mac platforms", () => {
    navigatorSpy.mockReturnValue("MacIntel")
    expect(isFromMac()).toBe(true)

    navigatorSpy.mockReturnValue("MacPPC")
    expect(isFromMac()).toBe(true)
  })

  it("should return false on non-Mac platforms", () => {
    navigatorSpy.mockReturnValue("Win32")
    expect(isFromMac()).toBe(false)

    navigatorSpy.mockReturnValue("Linux x86_64")
    expect(isFromMac()).toBe(false)
  })
})

describe("isFromWindows", () => {
  let navigatorSpy: MockInstance

  beforeEach(() => {
    navigatorSpy = vi.spyOn(navigator, "platform", "get")
  })

  afterEach(() => {
    navigatorSpy.mockRestore()
  })

  it("should return true on Windows platforms", () => {
    navigatorSpy.mockReturnValue("Win32")
    expect(isFromWindows()).toBe(true)

    navigatorSpy.mockReturnValue("Win64")
    expect(isFromWindows()).toBe(true)
  })

  it("should return false on non-Windows platforms", () => {
    navigatorSpy.mockReturnValue("MacIntel")
    expect(isFromWindows()).toBe(false)

    navigatorSpy.mockReturnValue("Linux x86_64")
    expect(isFromWindows()).toBe(false)
  })
})

describe("isValidElementId", () => {
  it("should return true for valid element IDs", () => {
    expect(isValidElementId("$$ID-abc123-userKey")).toBe(true)
    expect(isValidElementId("$$ID-hash-key-extra")).toBe(true)
  })

  it("should return false for invalid element IDs", () => {
    expect(isValidElementId("invalid-id")).toBe(false)
    expect(isValidElementId("$$ID")).toBe(false)
    expect(isValidElementId("$$ID-only")).toBe(false)
    expect(isValidElementId("")).toBe(false)
    expect(isValidElementId(null)).toBe(false)
    expect(isValidElementId(undefined)).toBe(false)
  })
})

describe("getElementId", () => {
  it("should return undefined for element without valid ID", () => {
    const element = new Element({
      alert: { body: "test" },
    })
    expect(getElementId(element)).toBeUndefined()
  })
})

describe("isValidFormId", () => {
  it("should return true for valid form IDs", () => {
    expect(isValidFormId("form-id")).toBe(true)
    expect(isValidFormId("a")).toBe(true)
  })

  it("should return false for invalid form IDs", () => {
    expect(isValidFormId("")).toBe(false)
    expect(isValidFormId(undefined)).toBe(false)
  })
})

describe("isInForm", () => {
  it("should return true when widget has valid formId", () => {
    expect(isInForm({ formId: "my-form" })).toBe(true)
  })

  it("should return false when widget has no formId", () => {
    expect(isInForm({})).toBe(false)
    expect(isInForm({ formId: "" })).toBe(false)
  })
})

describe("labelVisibilityProtoValueToEnum", () => {
  it("should convert VISIBLE to LabelVisibilityOptions.Visible", () => {
    expect(
      labelVisibilityProtoValueToEnum(
        LabelVisibilityProto.LabelVisibilityOptions.VISIBLE
      )
    ).toBe(LabelVisibilityOptions.Visible)
  })

  it("should convert HIDDEN to LabelVisibilityOptions.Hidden", () => {
    expect(
      labelVisibilityProtoValueToEnum(
        LabelVisibilityProto.LabelVisibilityOptions.HIDDEN
      )
    ).toBe(LabelVisibilityOptions.Hidden)
  })

  it("should convert COLLAPSED to LabelVisibilityOptions.Collapsed", () => {
    expect(
      labelVisibilityProtoValueToEnum(
        LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED
      )
    ).toBe(LabelVisibilityOptions.Collapsed)
  })

  it("should default to Visible for null or undefined", () => {
    expect(labelVisibilityProtoValueToEnum(null)).toBe(
      LabelVisibilityOptions.Visible
    )
    expect(labelVisibilityProtoValueToEnum(undefined)).toBe(
      LabelVisibilityOptions.Visible
    )
  })
})

describe("chatInputAcceptFileProtoValueToEnum", () => {
  it("should convert NONE to AcceptFileValue.None", () => {
    expect(
      chatInputAcceptFileProtoValueToEnum(ChatInputProto.AcceptFile.NONE)
    ).toBe(AcceptFileValue.None)
  })

  it("should convert SINGLE to AcceptFileValue.Single", () => {
    expect(
      chatInputAcceptFileProtoValueToEnum(ChatInputProto.AcceptFile.SINGLE)
    ).toBe(AcceptFileValue.Single)
  })

  it("should convert MULTIPLE to AcceptFileValue.Multiple", () => {
    expect(
      chatInputAcceptFileProtoValueToEnum(ChatInputProto.AcceptFile.MULTIPLE)
    ).toBe(AcceptFileValue.Multiple)
  })

  it("should convert DIRECTORY to AcceptFileValue.Directory", () => {
    expect(
      chatInputAcceptFileProtoValueToEnum(ChatInputProto.AcceptFile.DIRECTORY)
    ).toBe(AcceptFileValue.Directory)
  })
})

describe("generateUID", () => {
  it("should generate a string", () => {
    const uid = generateUID()
    expect(typeof uid).toBe("string")
  })

  it("should generate unique IDs", () => {
    const uid1 = generateUID()
    const uid2 = generateUID()
    expect(uid1).not.toBe(uid2)
  })
})

describe("getEmbeddingIdClassName", () => {
  it("should return correct class name format", () => {
    expect(getEmbeddingIdClassName("abc123")).toBe("stAppEmbeddingId-abc123")
  })
})

describe("extractPageNameFromPathName", () => {
  it("should extract page name from pathname", () => {
    expect(extractPageNameFromPathName("/app/mypage", "/app")).toBe("mypage")
  })

  it("should handle trailing slashes", () => {
    expect(extractPageNameFromPathName("/app/mypage/", "/app")).toBe("mypage")
  })

  it("should handle basePath with trailing slash", () => {
    expect(extractPageNameFromPathName("/app/mypage", "/app/")).toBe("mypage")
  })

  it("should return empty string when pathname equals basePath", () => {
    expect(extractPageNameFromPathName("/app", "/app")).toBe("")
  })

  it("should decode URL encoded page names", () => {
    expect(extractPageNameFromPathName("/app/my%20page", "/app")).toBe(
      "my page"
    )
  })
})

describe("makeElementWithInfoText", () => {
  it("should create an info alert element", () => {
    const element = makeElementWithInfoText("Info message")
    expect(element.alert).toBeDefined()
    expect(element.alert?.body).toBe("Info message")
  })
})

describe("makeElementWithErrorText", () => {
  it("should create an error alert element", () => {
    const element = makeElementWithErrorText("Error message")
    expect(element.alert).toBeDefined()
    expect(element.alert?.body).toBe("Error message")
  })
})

describe("makeAppSkeletonElement", () => {
  it("should create an app skeleton element", () => {
    const element = makeAppSkeletonElement()
    expect(element.skeleton).toBeDefined()
  })
})
