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

import { beforeEach, describe, expect, it, vi } from "vitest"

import { isHostConfigBypassEnabled } from "@streamlit/connection"

import {
  preferWindowValue,
  reconcileHostConfigValues,
} from "./hostConfigHelpers"

// Mock the isHostConfigBypassEnabled function
vi.mock("@streamlit/connection", () => ({
  isHostConfigBypassEnabled: vi.fn(),
}))

describe("preferWindowValue", () => {
  it("returns window value when it is defined", () => {
    expect(preferWindowValue("window", "endpoint")).toBe("window")
  })

  it("returns endpoint value when window value is undefined", () => {
    expect(preferWindowValue(undefined, "endpoint")).toBe("endpoint")
  })

  it("handles boolean false as defined window value", () => {
    expect(preferWindowValue(false, true)).toBe(false)
  })

  it("handles number 0 as defined window value", () => {
    expect(preferWindowValue(0, 100)).toBe(0)
  })

  it("handles empty string as defined window value", () => {
    expect(preferWindowValue("", "endpoint")).toBe("")
  })

  it("handles empty array as defined window value", () => {
    const emptyArray: string[] = []
    const endpointArray = ["a", "b"]
    expect(preferWindowValue(emptyArray, endpointArray)).toBe(emptyArray)
  })

  it("works with complex objects", () => {
    const windowObj = { foo: "bar" }
    const endpointObj = { foo: "baz" }
    expect(preferWindowValue(windowObj, endpointObj)).toBe(windowObj)
  })

  it("works with arrays", () => {
    const windowArr = ["a", "b"]
    const endpointArr = ["c", "d"]
    expect(preferWindowValue(windowArr, endpointArr)).toEqual(["a", "b"])
  })
})

describe("reconcileHostConfigValues", () => {
  const mockEndpointConfig = {
    allowedOrigins: ["https://endpoint.com"],
    useExternalAuthToken: false,
    metricsUrl: "https://metrics.endpoint.com",
    disableFullscreenMode: true,
    enableCustomParentMessages: false,
    mapboxToken: "endpoint-token",
    enforceDownloadInNewTab: false,
    blockErrorDialogs: false,
  }

  beforeEach(() => {
    // By default, assume bypass is enabled (valid config provided)
    vi.mocked(isHostConfigBypassEnabled).mockReturnValue(true)
  })

  it("returns endpoint config unchanged when initialHostConfig is undefined", () => {
    const result = reconcileHostConfigValues(undefined, mockEndpointConfig)
    expect(result).toEqual(mockEndpointConfig)
  })

  it("overrides allowedOrigins with window value", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    expect(result.allowedOrigins).toEqual(["https://window.com"])
    expect(result.useExternalAuthToken).toBe(true)
  })

  it("overrides useExternalAuthToken with window value", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    expect(result.useExternalAuthToken).toBe(true)
  })

  it("overrides metricsUrl with window value", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
      metricsUrl: "postMessage" as const,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    expect(result.metricsUrl).toBe("postMessage")
  })

  it("preserves non-minimal config fields from endpoint", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
      metricsUrl: "postMessage" as const,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    // These should NOT be overridden
    expect(result.disableFullscreenMode).toBe(true)
    expect(result.enableCustomParentMessages).toBe(false)
    expect(result.mapboxToken).toBe("endpoint-token")
    expect(result.enforceDownloadInNewTab).toBe(false)
    expect(result.blockErrorDialogs).toBe(false)
  })

  it("uses endpoint values for minimal fields when window values are undefined", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
      // metricsUrl is undefined
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    // Window values should be used
    expect(result.allowedOrigins).toEqual(["https://window.com"])
    expect(result.useExternalAuthToken).toBe(true)
    // Endpoint value should be used for metricsUrl
    expect(result.metricsUrl).toBe("https://metrics.endpoint.com")
  })

  it("handles all window values being undefined", () => {
    const initialHostConfig = {
      // All optional fields undefined
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    // Should use all endpoint values
    expect(result).toEqual(mockEndpointConfig)
  })

  it("returns endpoint config when bypass is not enabled", () => {
    // Simulate invalid config that fails bypass eligibility check
    vi.mocked(isHostConfigBypassEnabled).mockReturnValue(false)

    const initialHostConfig = {
      allowedOrigins: [] as string[], // Empty array - invalid for bypass
      useExternalAuthToken: false,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    // Should use endpoint values because bypass is not eligible
    expect(result.allowedOrigins).toEqual(["https://endpoint.com"])
    expect(result.useExternalAuthToken).toBe(false) // From endpoint
    expect(result).toEqual(mockEndpointConfig)
  })

  it("returns endpoint config when bypass eligibility check fails", () => {
    // Even if initialHostConfig is provided, if bypass check fails, use endpoint
    vi.mocked(isHostConfigBypassEnabled).mockReturnValue(false)

    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
      metricsUrl: "postMessage" as const,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    // Should use endpoint config unchanged when bypass is not enabled
    expect(result).toEqual(mockEndpointConfig)
  })

  it("handles metricsUrl: 'off' from window", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
      metricsUrl: "off" as const,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    expect(result.metricsUrl).toBe("off")
  })

  it("handles useExternalAuthToken: false from window (not undefined)", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: false, // Explicitly false
    }

    const endpointConfig = {
      ...mockEndpointConfig,
      useExternalAuthToken: true, // Different from window
    }

    const result = reconcileHostConfigValues(initialHostConfig, endpointConfig)

    // Window value (false) should be used, not endpoint (true)
    expect(result.useExternalAuthToken).toBe(false)
  })

  it("preserves endpoint config object reference for non-overridden fields", () => {
    const initialHostConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(
      initialHostConfig,
      mockEndpointConfig
    )

    // The result should be a new object
    expect(result).not.toBe(mockEndpointConfig)
  })
})
