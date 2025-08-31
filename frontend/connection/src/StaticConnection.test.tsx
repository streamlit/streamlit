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

import { ForwardMsgList } from "@streamlit/protobuf"

import { ConnectionState } from "./ConnectionState"
import { DefaultStreamlitEndpoints } from "./DefaultStreamlitEndpoints"
import {
  dispatchAppForwardMessages,
  establishStaticConnection,
  getProtoResponse,
  getStaticConfig,
  LOG,
} from "./StaticConnection"

describe("StaticConnection", () => {
  let logErrorSpy: MockInstance

  beforeAll(() => {
    vi.mock(import("./utils"), async importOriginal => {
      const actual = await importOriginal()
      return {
        ...actual,
        localStorageAvailable: vi.fn().mockReturnValue(true),
      }
    })
  })

  beforeEach(() => {
    logErrorSpy = vi.spyOn(LOG, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("getStaticConfig", () => {
    it("fetches URL from localStorage if available", async () => {
      // eslint-disable-next-line no-proto
      vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(
        "https://example.com"
      )
      const result = await getStaticConfig()
      expect(result).toBe("https://example.com")
    })

    it("fetches URL from STATIC_ASSET_CONFIG if not in localStorage", async () => {
      // eslint-disable-next-line no-proto
      vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null)
      // eslint-disable-next-line no-proto
      const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem")

      // Mock fetch for our static asset location
      // @ts-expect-error
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ static_url: "https://example.com" }),
        })
      )

      const result = await getStaticConfig()

      expect(fetch).toHaveBeenCalledWith(
        "https://data.streamlit.io/static.json",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(result).toBe("https://example.com")
      expect(setItemSpy).toHaveBeenCalledWith(
        "stStaticAssetUrl",
        "https://example.com"
      )
    })

    it("logs error when fetch fails", async () => {
      // eslint-disable-next-line no-proto
      vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null)
      // Mock fetch for our static asset location
      // @ts-expect-error
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        })
      )

      const result = await getStaticConfig()

      expect(result).toBe("")
      expect(logErrorSpy).toHaveBeenCalledWith(
        "Failed to fetch static config url: ",
        404
      )
    })
  })

  describe("getProtoResponse", () => {
    it("fetches proto response from correct URL", async () => {
      const staticAppId = "123"
      const staticConfigUrl = "www.example.com"

      // Mock fetch for our protos
      // @ts-expect-error
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        })
      )

      const result = await getProtoResponse(staticAppId, staticConfigUrl)

      expect(fetch).toHaveBeenCalledWith(
        "www.example.com/123/protos.pb",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(result).toBeInstanceOf(ArrayBuffer)
    })

    it("logs error if fetch fails", async () => {
      const staticAppId = "123"
      const staticConfigUrl = "www.example.com"

      // Mock fetch for our protos
      // @ts-expect-error
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        })
      )

      const result = await getProtoResponse(staticAppId, staticConfigUrl)

      expect(result).toBeNull()
      expect(logErrorSpy).toHaveBeenCalledWith(
        `Failed to fetch static app protos for id: ${staticAppId}`,
        404
      )
    })
  })

  describe("dispatchAppForwardMessages", () => {
    const staticAppId = "123"
    const staticConfigUrl = "www.example.com"
    const onMessage = vi.fn()
    const onConnectionError = vi.fn()

    it("decodes and dispatches messages", async () => {
      // Handles getProtoResponse
      // @ts-expect-error
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        })
      )

      const mockForwardMsgList = new ForwardMsgList({
        messages: [{ hash: "string1" }, { hash: "string2" }],
      })
      const decodeSpy = vi
        .spyOn(ForwardMsgList, "decode")
        .mockReturnValue(mockForwardMsgList)

      await dispatchAppForwardMessages(
        staticAppId,
        staticConfigUrl,
        onMessage,
        onConnectionError
      )

      expect(decodeSpy).toHaveBeenCalled()
      expect(onMessage).toHaveBeenCalledTimes(2)
    })

    it("logs error if arrayBuffer is undefined", async () => {
      // Handles getProtoResponse
      // @ts-expect-error
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(null),
        })
      )

      await dispatchAppForwardMessages(
        staticAppId,
        staticConfigUrl,
        onMessage,
        onConnectionError
      )

      expect(logErrorSpy).toHaveBeenCalledWith(
        "Failed to retrieve static app protos"
      )
    })
  })

  describe("StaticConnection", () => {
    const MOCK_SERVER_URI = {
      hostname: "streamlit.mock",
      port: "80",
      pathname: "/mock/base/path",
    } as URL
    const endpoints = new DefaultStreamlitEndpoints({
      getServerUri: () => MOCK_SERVER_URI,
      csrfEnabled: false,
      sendClientError: vi.fn(),
    })

    beforeEach(() => {
      // Handles getStaticConfig
      // eslint-disable-next-line no-proto
      vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(
        "www.example.com"
      )

      // Handles getProtoResponse
      // @ts-expect-error
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        })
      )
    })

    it("handles connection state changes and message dispatch", async () => {
      const staticAppId = "123"
      const staticConfigUrl = "www.example.com"
      const onConnectionStateChange = vi.fn()
      const onMessage = vi.fn()
      const onConnectionError = vi.fn()

      await establishStaticConnection(
        staticAppId,
        onConnectionStateChange,
        onMessage,
        onConnectionError,
        endpoints
      )

      expect(onConnectionStateChange).toHaveBeenCalledWith(
        ConnectionState.STATIC_CONNECTING
      )
      await dispatchAppForwardMessages(
        staticAppId,
        staticConfigUrl,
        onMessage,
        onConnectionError
      )
      expect(onConnectionStateChange).toHaveBeenCalledWith(
        ConnectionState.STATIC_CONNECTED
      )
    })
  })
})
