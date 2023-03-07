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
  buildHttpUri,
  buildMediaUri,
  buildWsUri,
  getPossibleBaseUris,
  getWindowBaseUriParts,
  isValidOrigin,
  xssSanitizeSvg,
} from "./UriUtil"

const location: Partial<Location> = {}

global.window = Object.create(window)
Object.defineProperty(window, "location", { value: location })

test("gets all window URI parts", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = "foo"

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "foo",
  })
})

test("gets window URI parts without basePath", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = ""

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "",
  })
})

test("gets window URI parts with long basePath", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = "/foo/bar"

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "foo/bar",
  })
})

test("gets window URI parts with weird basePath", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = "///foo/bar//"

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "foo/bar",
  })
})

test("builds HTTP URI correctly", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/foo/bar/baz")
})

test("builds HTTPS URI correctly", () => {
  location.href = "https://something"
  const uri = buildHttpUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("https://the_host:9988/foo/bar/baz")
})

test("builds HTTP URI with no base path", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "",
    },
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/baz")
})

test("builds WS URI correctly", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/foo/bar/baz")
})

test("builds WSS URI correctly", () => {
  location.href = "https://something"
  const uri = buildWsUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("wss://the_host:9988/foo/bar/baz")
})

test("builds WS URI with no base path", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "",
    },
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/baz")
})

test("builds uri correctly for streamlit-served media", () => {
  const uri = buildMediaUri("/media/1234567890.png")

  expect(uri).toBe("http://the_host:9988/foo/bar/media/1234567890.png")
})

test("passes through other media uris", () => {
  const uri = buildMediaUri("http://example/blah.png")

  expect(uri).toBe("http://example/blah.png")
})

test("sanitizes SVG uris", () => {
  const uri = xssSanitizeSvg(
    `data:image/svg+xml,<svg><script>alert('evil')</script></svg>`
  )

  expect(uri).toBe(`<svg></svg>`)
})

describe("isValidOrigin", () => {
  it("returns false if allowedOrigin is invalid", () => {
    // allowedOrigin doesn't have a protocol
    expect(
      isValidOrigin("devel.streamlit.io", "http://devel.streamlit.io")
    ).toBeFalsy()
  })

  it("returns false if testOrigin is invalid", () => {
    // testOrigin doesn't have a protocol
    expect(
      isValidOrigin("http://devel.streamlit.io", "devel.streamlit.io")
    ).toBeFalsy()
  })

  it("returns false if protocols don't match", () => {
    expect(
      isValidOrigin("https://devel.streamlit.io", "http://devel.streamlit.io")
    ).toBeFalsy()
  })

  it("returns false if ports don't match", () => {
    expect(
      isValidOrigin(
        "https://devel.streamlit.io:8080",
        "https://devel.streamlit.io"
      )
    ).toBeFalsy()
  })

  it("returns true when the pattern and url are the same", () => {
    expect(
      isValidOrigin("http://devel.streamlit.io", "http://devel.streamlit.io")
    ).toBeTruthy()
  })

  it("returns false if it has different form", () => {
    expect(isValidOrigin("https://*.com", "https://test.test.com")).toBeFalsy()
  })

  it("returns true if it matches the pattern", () => {
    expect(isValidOrigin("https://*.com", "https://a.com")).toBeTruthy()
    expect(isValidOrigin("https://*.a.com", "https://asd.a.com")).toBeTruthy()
    expect(
      isValidOrigin("https://www.*.a.com", "https://www.asd.a.com")
    ).toBeTruthy()
    expect(
      isValidOrigin("https://abc.*.*.a.com", "https://abc.def.xyz.a.com")
    ).toBeTruthy()
  })

  it("returns false if it doesn't match the pattern", () => {
    expect(isValidOrigin("https://*.b.com", "https://www.c.com")).toBeFalsy()
  })
})

describe("getPossibleBaseUris", () => {
  let originalPathName = ""

  beforeEach(() => {
    originalPathName = window.location.pathname
  })

  afterEach(() => {
    window.location.pathname = originalPathName
  })

  const testCases = [
    {
      description: "empty pathnames",
      pathname: "",
      expectedBasePaths: [""],
    },
    {
      description: "pathnames with a single part",
      pathname: "foo",
      expectedBasePaths: ["foo", ""],
    },
    {
      description: "pathnames with two parts",
      pathname: "foo/bar",
      expectedBasePaths: ["foo/bar", "foo"],
    },
    {
      description: "pathnames with more than two parts",
      pathname: "foo/bar/baz/qux",
      expectedBasePaths: ["foo/bar/baz/qux", "foo/bar/baz"],
    },
  ]

  testCases.forEach(({ description, pathname, expectedBasePaths }) => {
    it(`handles ${description}`, () => {
      window.location.pathname = pathname

      expect(getPossibleBaseUris().map(b => b.basePath)).toEqual(
        expectedBasePaths
      )
    })
  })
})
