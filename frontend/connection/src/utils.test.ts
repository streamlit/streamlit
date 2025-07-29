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

import { buildHttpUri } from "@streamlit/utils"

import {
  buildWsUri,
  getPossibleBaseUris,
  parseUriIntoBaseParts,
} from "./utils"

describe("parseUriIntoBaseParts", () => {
  const location: Partial<Location> = {}
  const { location: originalLocation } = window

  beforeEach(() => {
    Object.defineProperty(window, "location", { value: location })
  })

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  test("gets all window URI parts", () => {
    location.href = "https://the_host:9988/foo"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/foo",
    })
  })

  test("gets window URI parts without basePath", () => {
    location.href = "https://the_host:9988"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/",
    })
  })

  test("gets window URI parts with long basePath", () => {
    location.href = "https://the_host:9988/foo/bar"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/foo/bar",
    })
  })

  test("gets window URI parts with weird basePath", () => {
    location.href = "https://the_host:9988///foo/bar//"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/foo/bar",
    })
  })
})

test("Uses provided URL instead of window.location.href to get URI parts if provided", () => {
  location.href = "https://the_host:9988/foo/bar"

  expect(
    parseUriIntoBaseParts("https://the_other_host:9999/foo/bar/baz")
  ).toMatchObject({
    protocol: "https:",
    hostname: "the_other_host",
    port: "9999",
    pathname: "/foo/bar/baz",
  })
})

test("builds HTTP URI correctly", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/foo/bar/baz")
})

test("builds HTTPS URI correctly", () => {
  location.href = "https://something"
  const uri = buildHttpUri(
    {
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("https://the_host:9988/foo/bar/baz")
})

test("builds HTTP URI with no base path", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "",
    } as URL,
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/baz")
})

test("builds WS URI correctly", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/foo/bar/baz")
})

test("builds WSS URI correctly", () => {
  const uri = buildWsUri(
    {
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("wss://the_host:9988/foo/bar/baz")
})

test("builds WS URI with no base path", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "",
    } as URL,
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/baz")
})

describe("getPossibleBaseUris", () => {
  let originalPathName = ""
  const { location: originalLocation } = window

  beforeEach(() => {
    originalPathName = window.location.pathname
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        ...originalLocation,
        origin: "https://app.example.com:8080",
      },
    })
  })

  afterEach(() => {
    window.__streamlit = undefined
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, pathname: originalPathName },
      writable: true,
      configurable: true,
    })
  })

  const testCases = [
    {
      description: "empty pathnames",
      pathname: "/",
      expectedBasePaths: ["/"],
    },
    {
      description: "pathnames with a single part",
      pathname: "/foo",
      expectedBasePaths: ["/foo", "/"],
    },
    {
      description: "pathnames with two parts",
      pathname: "/foo/bar",
      expectedBasePaths: ["/foo/bar", "/foo"],
    },
    {
      description: "pathnames with more than two parts",
      pathname: "/foo/bar/baz/qux",
      expectedBasePaths: ["/foo/bar/baz/qux", "/foo/bar/baz"],
    },
  ]

  testCases.forEach(({ description, pathname, expectedBasePaths }) => {
    it(`handles ${description}`, () => {
      window.location.href = `https://not_a_host:80${pathname}`

      expect(getPossibleBaseUris().map(b => b.pathname)).toEqual(
        expectedBasePaths
      )
    })
  })

  it("Calculates possibleBaseUris with window.__streamlit.BACKEND_BASE_URL if set", () => {
    window.__streamlit = { BACKEND_BASE_URL: "https://used_host:443/foo/bar" }
    window.location.href = "https://unused_host:443/foo/bar"

    const possibleBaseUris = getPossibleBaseUris()
    expect(possibleBaseUris[0]).toMatchObject({
      protocol: "https:",
      hostname: "used_host",
      pathname: "/foo/bar",
    })

    expect(possibleBaseUris[1]).toMatchObject({
      protocol: "https:",
      hostname: "used_host",
      pathname: "/foo",
    })
  })
})
