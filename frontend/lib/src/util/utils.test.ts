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

import {
  getCookie,
  setCookie,
  isEmbed,
  getEmbedUrlParams,
  EMBED_QUERY_PARAM_VALUES,
  EMBED_QUERY_PARAM_KEY,
} from "./utils"

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
    "show_colored_line",
    "show_toolbar",
    "show_padding",
    "disable_scrolling",
    "show_footer",
    "light_theme",
    "dark_theme",
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
  let windowSpy: jest.SpyInstance

  beforeEach(() => {
    windowSpy = jest.spyOn(window, "window", "get")
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
  let windowSpy: jest.SpyInstance

  beforeEach(() => {
    windowSpy = jest.spyOn(window, "window", "get")
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
