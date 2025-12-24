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

import { describe, expect, it } from "vitest"

import { isValidAllowedOrigins } from "@streamlit/utils"

import {
  includeIfDefined,
  preferWindowValue,
  reconcileHostConfigValues,
} from "./hostConfigHelpers"

describe("includeIfDefined", () => {
  it("filters out undefined values", () => {
    const input = {
      defined: "value",
      alsoUndefined: undefined,
      number: 42,
    }
    const result = includeIfDefined(input)
    expect(result).toEqual({ defined: "value", number: 42 })
    expect(result).not.toHaveProperty("alsoUndefined")
  })

  it.each([
    ["false", { flag: false, other: undefined }, { flag: false }],
    ["null", { value: null, other: undefined }, { value: null }],
    ["0", { count: 0, other: undefined }, { count: 0 }],
    ["empty string", { text: "", other: undefined }, { text: "" }],
    ["empty array", { items: [], other: undefined }, { items: [] }],
  ] as const)("keeps %s values", (_description, input, expected) => {
    const result = includeIfDefined(input)
    expect(result).toEqual(expected)
  })

  it("returns empty object when all values are undefined", () => {
    const input = { a: undefined, b: undefined }
    const result = includeIfDefined(input)
    expect(result).toEqual({})
  })

  it("handles empty input object", () => {
    const result = includeIfDefined({})
    expect(result).toEqual({})
  })
})

describe("isValidAllowedOrigins", () => {
  it.each([
    [["https://example.com"], "single valid origin"],
    [
      ["https://example1.com", "https://example2.com"],
      "multiple valid origins",
    ],
  ])("returns true for %s (%s)", (input, _description) => {
    expect(isValidAllowedOrigins(input)).toBe(true)
  })

  it.each([
    [[], "empty array"],
    [undefined, "undefined"],
    [null, "null"],
    ["https://example.com", "string instead of array"],
    [{ 0: "https://example.com" }, "object instead of array"],
    [[123], "array with number"],
    [[null], "array with null"],
    [[undefined], "array with undefined"],
    [["https://example.com", 123], "array with mixed types"],
    [[""], "array with empty string"],
    [["https://example.com", ""], "array with valid and empty string"],
    [["", "https://example.com"], "array starting with empty string"],
    [["", ""], "array with only empty strings"],
    [["  "], "array with whitespace-only string"],
    [["https://example.com", "  "], "array with valid and whitespace-only"],
  ])("returns false for %s (%s)", (input, _description) => {
    expect(isValidAllowedOrigins(input)).toBe(false)
  })
})

describe("preferWindowValue", () => {
  it("returns window value when it is defined", () => {
    expect(preferWindowValue("window", "endpoint")).toBe("window")
  })

  it.each([
    ["boolean false", false, true, false],
    ["number 0", 0, 100, 0],
    ["empty string", "", "endpoint", ""],
  ] as const)(
    "handles %s as defined window value",
    (_description, windowValue, endpointValue, expected) => {
      expect(preferWindowValue(windowValue, endpointValue)).toBe(expected)
    }
  )

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

  it.each([
    ["null", null],
    ["undefined", undefined],
  ] as const)(
    "treats %s as not provided (uses endpoint value)",
    (_, value) => {
      expect(preferWindowValue(value, "endpoint")).toBe("endpoint")
    }
  )

  it("prefers window value even when endpoint is null", () => {
    expect(preferWindowValue("window", null as unknown as string)).toBe(
      "window"
    )
  })
})

describe("reconcileHostConfigValues", () => {
  const mockEndpointConfig = {
    // AppConfig fields
    allowedOrigins: ["https://endpoint.com"],
    useExternalAuthToken: false,
    enableCustomParentMessages: false,
    blockErrorDialogs: false,
    // LibConfig fields
    mapboxToken: "endpoint-token",
    disableFullscreenMode: true,
    enforceDownloadInNewTab: false,
    resourceCrossOriginMode: "anonymous" as const,
    // MetricsConfig fields
    metricsUrl: "https://metrics.endpoint.com",
  }

  it("returns endpoint config unchanged when windowConfig is undefined", () => {
    const result = reconcileHostConfigValues(undefined, mockEndpointConfig)
    expect(result).toEqual(mockEndpointConfig)
  })

  // Test AppConfig fields
  it("overrides allowedOrigins with window value", () => {
    const windowConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.allowedOrigins).toEqual(["https://window.com"])
    expect(result.useExternalAuthToken).toBe(true)
  })

  it("overrides useExternalAuthToken with window value", () => {
    const windowConfig = {
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.useExternalAuthToken).toBe(true)
    // Other fields should use endpoint values
    expect(result.allowedOrigins).toEqual(["https://endpoint.com"])
  })

  it("overrides enableCustomParentMessages with window value", () => {
    const windowConfig = {
      enableCustomParentMessages: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.enableCustomParentMessages).toBe(true)
    // Other fields should use endpoint values
    expect(result.useExternalAuthToken).toBe(false)
  })

  it("overrides blockErrorDialogs with window value", () => {
    const windowConfig = {
      blockErrorDialogs: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.blockErrorDialogs).toBe(true)
    // Other fields should use endpoint values
    expect(result.enableCustomParentMessages).toBe(false)
  })

  // Test LibConfig fields
  it("overrides mapboxToken with window value", () => {
    const windowConfig = {
      mapboxToken: "window-token",
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.mapboxToken).toBe("window-token")
    // Other fields should use endpoint values
    expect(result.disableFullscreenMode).toBe(true)
  })

  it("overrides disableFullscreenMode with window value", () => {
    const windowConfig = {
      disableFullscreenMode: false,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.disableFullscreenMode).toBe(false)
    // Other fields should use endpoint values
    expect(result.mapboxToken).toBe("endpoint-token")
  })

  it("overrides enforceDownloadInNewTab with window value", () => {
    const windowConfig = {
      enforceDownloadInNewTab: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.enforceDownloadInNewTab).toBe(true)
    // Other fields should use endpoint values
    expect(result.disableFullscreenMode).toBe(true)
  })

  it("overrides resourceCrossOriginMode with window value", () => {
    const windowConfig = {
      resourceCrossOriginMode: "use-credentials" as const,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.resourceCrossOriginMode).toBe("use-credentials")
    // Other fields should use endpoint values
    expect(result.mapboxToken).toBe("endpoint-token")
  })

  // Test MetricsConfig fields
  it("overrides metricsUrl with window value", () => {
    const windowConfig = {
      metricsUrl: "postMessage" as const,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.metricsUrl).toBe("postMessage")
  })

  // Test partial window config
  it("handles partial window config (only some fields provided)", () => {
    const windowConfig = {
      allowedOrigins: ["https://window.com"],
      mapboxToken: "window-token",
      // Other fields undefined
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Window values should be used
    expect(result.allowedOrigins).toEqual(["https://window.com"])
    expect(result.mapboxToken).toBe("window-token")
    // Endpoint values should be used for unprovided fields
    expect(result.useExternalAuthToken).toBe(false)
    expect(result.enableCustomParentMessages).toBe(false)
    expect(result.blockErrorDialogs).toBe(false)
    expect(result.disableFullscreenMode).toBe(true)
    expect(result.enforceDownloadInNewTab).toBe(false)
    expect(result.resourceCrossOriginMode).toBe("anonymous")
    expect(result.metricsUrl).toBe("https://metrics.endpoint.com")
  })

  // Test complete window config
  it("handles complete window config (all 9 fields provided)", () => {
    const windowConfig = {
      // AppConfig
      allowedOrigins: ["https://window1.com", "https://window2.com"],
      useExternalAuthToken: true,
      enableCustomParentMessages: true,
      blockErrorDialogs: true,
      // LibConfig
      mapboxToken: "window-mapbox-token",
      disableFullscreenMode: false,
      enforceDownloadInNewTab: true,
      resourceCrossOriginMode: "use-credentials" as const,
      // MetricsConfig
      metricsUrl: "postMessage" as const,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // All window values should be used
    expect(result.allowedOrigins).toEqual([
      "https://window1.com",
      "https://window2.com",
    ])
    expect(result.useExternalAuthToken).toBe(true)
    expect(result.enableCustomParentMessages).toBe(true)
    expect(result.blockErrorDialogs).toBe(true)
    expect(result.mapboxToken).toBe("window-mapbox-token")
    expect(result.disableFullscreenMode).toBe(false)
    expect(result.enforceDownloadInNewTab).toBe(true)
    expect(result.resourceCrossOriginMode).toBe("use-credentials")
    expect(result.metricsUrl).toBe("postMessage")
  })

  it("handles all window values being undefined", () => {
    const windowConfig = {
      // All optional fields undefined
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Should use all endpoint values
    expect(result).toEqual(mockEndpointConfig)
  })

  // Test allowedOrigins validation
  it("validates allowedOrigins and rejects empty array", () => {
    const windowConfig = {
      allowedOrigins: [] as string[], // Empty array - invalid
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Empty array should be rejected, endpoint value should be used
    expect(result.allowedOrigins).toEqual(["https://endpoint.com"])
    // But other window values should still be applied
    expect(result.useExternalAuthToken).toBe(true)
  })

  // Test special values
  it("handles metricsUrl: 'off' from window", () => {
    const windowConfig = {
      metricsUrl: "off" as const,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    expect(result.metricsUrl).toBe("off")
  })

  it("handles resourceCrossOriginMode: undefined from window (treated as not provided)", () => {
    const windowConfig = {
      resourceCrossOriginMode: undefined,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Undefined is treated as "not provided", so endpoint value is used
    // (JavaScript undefined is the same as not setting the property)
    expect(result.resourceCrossOriginMode).toBe("anonymous")
  })

  // Test boolean edge cases
  it("handles useExternalAuthToken: false from window (not undefined)", () => {
    const windowConfig = {
      useExternalAuthToken: false, // Explicitly false
    }

    const endpointConfig = {
      ...mockEndpointConfig,
      useExternalAuthToken: true, // Different from window
    }

    const result = reconcileHostConfigValues(windowConfig, endpointConfig)

    // Window value (false) should be used, not endpoint (true)
    expect(result.useExternalAuthToken).toBe(false)
  })

  it("handles boolean false values correctly for all boolean fields", () => {
    const windowConfig = {
      useExternalAuthToken: false,
      enableCustomParentMessages: false,
      blockErrorDialogs: false,
      disableFullscreenMode: false,
      enforceDownloadInNewTab: false,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // All false values should be preserved (not treated as undefined)
    expect(result.useExternalAuthToken).toBe(false)
    expect(result.enableCustomParentMessages).toBe(false)
    expect(result.blockErrorDialogs).toBe(false)
    expect(result.disableFullscreenMode).toBe(false)
    expect(result.enforceDownloadInNewTab).toBe(false)
  })

  // Test object reference
  it("returns a new object (does not modify endpoint config)", () => {
    const windowConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // The result should be a new object
    expect(result).not.toBe(mockEndpointConfig)
    // Original endpoint config should be unchanged
    expect(mockEndpointConfig.allowedOrigins).toEqual(["https://endpoint.com"])
  })

  // Test field precedence with different values
  it("applies all provided window fields even when they differ from endpoint", () => {
    const windowConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
      enableCustomParentMessages: true,
      blockErrorDialogs: true,
      mapboxToken: "window-token",
      disableFullscreenMode: false,
      enforceDownloadInNewTab: true,
      resourceCrossOriginMode: "use-credentials" as const,
      metricsUrl: "postMessage" as const,
    }

    const endpointConfig = {
      ...mockEndpointConfig,
      // All values different from window
      allowedOrigins: ["https://endpoint1.com", "https://endpoint2.com"],
      useExternalAuthToken: false,
      enableCustomParentMessages: false,
      blockErrorDialogs: false,
      mapboxToken: "endpoint-token",
      disableFullscreenMode: true,
      enforceDownloadInNewTab: false,
      resourceCrossOriginMode: "anonymous" as const,
      metricsUrl: "https://endpoint-metrics.com",
    }

    const result = reconcileHostConfigValues(windowConfig, endpointConfig)

    // All window values should take precedence
    expect(result.allowedOrigins).toEqual(["https://window.com"])
    expect(result.useExternalAuthToken).toBe(true)
    expect(result.enableCustomParentMessages).toBe(true)
    expect(result.blockErrorDialogs).toBe(true)
    expect(result.mapboxToken).toBe("window-token")
    expect(result.disableFullscreenMode).toBe(false)
    expect(result.enforceDownloadInNewTab).toBe(true)
    expect(result.resourceCrossOriginMode).toBe("use-credentials")
    expect(result.metricsUrl).toBe("postMessage")
  })

  it("preserves deprecated setAnonymousCrossOriginPropertyOnMediaElements from endpoint", () => {
    const endpointConfig = {
      ...mockEndpointConfig,
      setAnonymousCrossOriginPropertyOnMediaElements: true,
    }

    const result = reconcileHostConfigValues(undefined, endpointConfig)

    expect(result.setAnonymousCrossOriginPropertyOnMediaElements).toBe(true)
  })

  it("preserves deprecated field even when window config is provided", () => {
    const windowConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
    }
    const endpointConfig = {
      ...mockEndpointConfig,
      setAnonymousCrossOriginPropertyOnMediaElements: true,
    }

    const result = reconcileHostConfigValues(windowConfig, endpointConfig)

    // Window values override
    expect(result.allowedOrigins).toEqual(["https://window.com"])
    // Deprecated field preserved from endpoint
    expect(result.setAnonymousCrossOriginPropertyOnMediaElements).toBe(true)
  })

  it("rejects allowedOrigins with empty strings", () => {
    const windowConfig = {
      allowedOrigins: ["https://valid.com", ""],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Should use endpoint value, not window value with empty string
    expect(result.allowedOrigins).toEqual(mockEndpointConfig.allowedOrigins)
  })

  it("rejects allowedOrigins with only empty strings", () => {
    const windowConfig = {
      allowedOrigins: ["", ""],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Should use endpoint value
    expect(result.allowedOrigins).toEqual(mockEndpointConfig.allowedOrigins)
  })

  it("rejects allowedOrigins with non-string values", () => {
    const windowConfig = {
      allowedOrigins: ["https://valid.com", 123] as unknown as string[],
      useExternalAuthToken: true,
    }

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Should use endpoint value due to invalid window config
    expect(result.allowedOrigins).toEqual(mockEndpointConfig.allowedOrigins)
  })

  it("correctly overrides all boolean fields when set to false", () => {
    const windowConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: false, // false, not undefined
      enableCustomParentMessages: false,
      blockErrorDialogs: false,
      disableFullscreenMode: false,
      enforceDownloadInNewTab: false,
    }
    const endpointConfig = {
      ...mockEndpointConfig,
      // All endpoint values are true
      useExternalAuthToken: true,
      enableCustomParentMessages: true,
      blockErrorDialogs: true,
      disableFullscreenMode: true,
      enforceDownloadInNewTab: true,
    }

    const result = reconcileHostConfigValues(windowConfig, endpointConfig)

    // Window false values should override endpoint true values
    expect(result.useExternalAuthToken).toBe(false)
    expect(result.enableCustomParentMessages).toBe(false)
    expect(result.blockErrorDialogs).toBe(false)
    expect(result.disableFullscreenMode).toBe(false)
    expect(result.enforceDownloadInNewTab).toBe(false)
  })

  it("treats null window values as not provided", () => {
    const windowConfig = {
      allowedOrigins: ["https://window.com"],
      useExternalAuthToken: true,
      mapboxToken: null,
      metricsUrl: null,
    } as unknown as typeof mockEndpointConfig

    const result = reconcileHostConfigValues(windowConfig, mockEndpointConfig)

    // Null values should not override endpoint
    expect(result.mapboxToken).toBe(mockEndpointConfig.mapboxToken)
    expect(result.metricsUrl).toBe(mockEndpointConfig.metricsUrl)
    // Valid values should still override
    expect(result.allowedOrigins).toEqual(["https://window.com"])
  })
})
