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

import { act, renderHook, waitFor } from "@testing-library/react"
import type { Root as HastRoot } from "hast"
import type { Root as MdastRoot } from "mdast"
import type { VFile } from "vfile"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  _resetCacheForTesting,
  extractPlugin,
  isLoadedPlugin,
  LOAD_FAILED,
  type PluginState,
  useLazyPlugin,
  wrapRehypePlugin,
  wrapRemarkPlugin,
} from "./utils"

// Reset the module-level cache between tests to ensure isolation
afterEach(() => {
  _resetCacheForTesting()
})

describe("LOAD_FAILED", () => {
  it("is a unique symbol", () => {
    expect(typeof LOAD_FAILED).toBe("symbol")
    expect(LOAD_FAILED.description).toBe("plugin_load_failed")
  })
})

describe("isLoadedPlugin", () => {
  it("returns true for a loaded plugin (function)", () => {
    const plugin = vi.fn()
    expect(isLoadedPlugin(plugin)).toBe(true)
  })

  it("returns true for a loaded plugin (object)", () => {
    const plugin = { transform: vi.fn() }
    expect(isLoadedPlugin(plugin)).toBe(true)
  })

  it("returns false for null", () => {
    expect(isLoadedPlugin(null)).toBe(false)
  })

  it("returns false for LOAD_FAILED", () => {
    expect(isLoadedPlugin(LOAD_FAILED)).toBe(false)
  })
})

describe("extractPlugin", () => {
  it("extracts a function from module.default", () => {
    const pluginFn = vi.fn()
    const module = { default: pluginFn }

    const result = extractPlugin(module, "test-plugin")

    expect(result).toBe(pluginFn)
  })

  it("extracts a function from nested default exports", () => {
    const pluginFn = vi.fn()
    const module = { default: { default: pluginFn } }

    const result = extractPlugin(module, "test-plugin")

    expect(result).toBe(pluginFn)
  })

  it("extracts a function directly from module if no default", () => {
    const module = vi.fn()

    const result = extractPlugin(
      module as unknown as Record<string, unknown>,
      "test-plugin"
    )

    expect(result).toBe(module)
  })

  it("returns LOAD_FAILED if no function found", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})
    const module = { default: { notAFunction: "value" } }

    const result = extractPlugin(module, "test-plugin")

    expect(result).toBe(LOAD_FAILED)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[StreamlitMarkdown] Failed to load test-plugin plugin"
    )
    consoleWarnSpy.mockRestore()
  })

  it("handles circular default references without infinite loop", () => {
    // Create a true circular reference where default points to itself
    const module: Record<string, unknown> = {}
    module.default = module

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})

    const result = extractPlugin(module, "test-plugin")

    // The circular reference is detected (next === current), loop breaks,
    // but no function is found, so LOAD_FAILED is returned
    expect(result).toBe(LOAD_FAILED)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[StreamlitMarkdown] Failed to load test-plugin plugin"
    )
    consoleWarnSpy.mockRestore()
  })

  it("limits depth to 5 levels to prevent deep nesting issues", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})

    // Create deeply nested defaults (7 levels deep, beyond the 5-level limit)
    // The function is at depth 7, unreachable within the 5-level limit
    const module = {
      default: {
        default: {
          default: {
            default: {
              default: {
                default: {
                  default: vi.fn(), // depth 7 - unreachable
                },
              },
            },
          },
        },
      },
    }

    const result = extractPlugin(module, "test-plugin")

    // We only traverse 5 levels deep, so the function at depth 7 is not found.
    // The module itself is added as a fallback candidate but it's an object, not a function.
    // Therefore, LOAD_FAILED should be returned.
    expect(result).toBe(LOAD_FAILED)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[StreamlitMarkdown] Failed to load test-plugin plugin"
    )
    consoleWarnSpy.mockRestore()
  })

  it("finds function within the 5-level depth limit", () => {
    const pluginFn = vi.fn()
    // Function at depth 5 - should be found
    const module = {
      default: {
        default: {
          default: {
            default: {
              default: pluginFn, // depth 5 - reachable
            },
          },
        },
      },
    }

    const result = extractPlugin(module, "test-plugin")

    expect(result).toBe(pluginFn)
  })
})

describe("wrapRehypePlugin", () => {
  // Create properly typed mock objects matching HastRoot and VFile types
  const createMockHastTree = (): HastRoot => ({
    type: "root",
    children: [],
  })
  const createMockFile = (): VFile => ({ path: "test.md", value: "" }) as VFile

  it("wraps a plugin and calls the original transformer", () => {
    const mockTree = createMockHastTree()
    const mockFile = createMockFile()
    const transformer = vi.fn().mockReturnValue(mockTree)
    const plugin = vi.fn().mockReturnValue(transformer)

    const wrapped = wrapRehypePlugin(plugin, "test-plugin")
    const wrappedTransformer = wrapped()

    expect(plugin).toHaveBeenCalled()

    const result = wrappedTransformer(mockTree, mockFile)

    expect(transformer).toHaveBeenCalledWith(mockTree, mockFile)
    expect(result).toBe(mockTree)
  })

  it("returns undefined tree without calling transformer", () => {
    const transformer = vi.fn()
    const plugin = vi.fn().mockReturnValue(transformer)

    const wrapped = wrapRehypePlugin(plugin, "test-plugin")
    const wrappedTransformer = wrapped()
    // Test undefined handling - cast needed since HastRoot doesn't include undefined
    const result = wrappedTransformer(
      undefined as unknown as HastRoot,
      createMockFile()
    )

    expect(transformer).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it("catches errors and returns original tree", () => {
    const mockTree = createMockHastTree()
    const mockFile = createMockFile()
    const error = new Error("Plugin crashed!")
    const transformer = vi.fn().mockImplementation(() => {
      throw error
    })
    const plugin = vi.fn().mockReturnValue(transformer)
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const wrapped = wrapRehypePlugin(plugin, "test-plugin")
    const wrappedTransformer = wrapped()
    const result = wrappedTransformer(mockTree, mockFile)

    expect(result).toBe(mockTree)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[StreamlitMarkdown] test-plugin crashed while transforming",
      error
    )
    consoleErrorSpy.mockRestore()
  })

  it("passes plugin options through", () => {
    const mockTree = createMockHastTree()
    const transformer = vi.fn().mockReturnValue(mockTree)
    const plugin = vi.fn().mockReturnValue(transformer)
    const options = { strict: true, output: "html" }

    const wrapped = wrapRehypePlugin(plugin, "test-plugin")
    wrapped(options)

    expect(plugin).toHaveBeenCalledWith(options)
  })
})

describe("wrapRemarkPlugin", () => {
  // Create properly typed mock objects matching MdastRoot and VFile types
  const createMockMdastTree = (): MdastRoot => ({
    type: "root",
    children: [],
  })
  const createMockFile = (): VFile => ({ path: "test.md", value: "" }) as VFile

  it("wraps a plugin and calls the original transformer", () => {
    const mockTree = createMockMdastTree()
    const mockFile = createMockFile()
    const transformer = vi.fn().mockReturnValue(mockTree)
    const plugin = vi.fn().mockReturnValue(transformer)

    const wrapped = wrapRemarkPlugin(plugin, "test-plugin")
    const wrappedTransformer = wrapped()

    expect(plugin).toHaveBeenCalled()

    const result = wrappedTransformer(mockTree, mockFile)

    expect(transformer).toHaveBeenCalledWith(mockTree, mockFile)
    expect(result).toBe(mockTree)
  })

  it("returns undefined tree without calling transformer", () => {
    const transformer = vi.fn()
    const plugin = vi.fn().mockReturnValue(transformer)

    const wrapped = wrapRemarkPlugin(plugin, "test-plugin")
    const wrappedTransformer = wrapped()
    // Test undefined handling - cast needed since MdastRoot doesn't include undefined
    const result = wrappedTransformer(
      undefined as unknown as MdastRoot,
      createMockFile()
    )

    expect(transformer).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it("catches errors and returns original tree", () => {
    const mockTree = createMockMdastTree()
    const mockFile = createMockFile()
    const error = new Error("Plugin crashed!")
    const transformer = vi.fn().mockImplementation(() => {
      throw error
    })
    const plugin = vi.fn().mockReturnValue(transformer)
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const wrapped = wrapRemarkPlugin(plugin, "test-plugin")
    const wrappedTransformer = wrapped()
    const result = wrappedTransformer(mockTree, mockFile)

    expect(result).toBe(mockTree)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[StreamlitMarkdown] test-plugin crashed while transforming",
      error
    )
    consoleErrorSpy.mockRestore()
  })

  it("passes plugin options through", () => {
    const mockTree = createMockMdastTree()
    const transformer = vi.fn().mockReturnValue(mockTree)
    const plugin = vi.fn().mockReturnValue(transformer)
    const options = { emoticon: true, padSpaceAfter: false }

    const wrapped = wrapRemarkPlugin(plugin, "test-plugin")
    wrapped(options)

    expect(plugin).toHaveBeenCalledWith(options)
  })
})

describe("useLazyPlugin", () => {
  it("returns null initially when plugin is not needed", () => {
    const { result } = renderHook(() =>
      useLazyPlugin({
        key: "katex",
        needed: false,
        load: vi.fn(),
        pluginName: "test-plugin",
      })
    )

    expect(result.current).toBeNull()
  })

  it("loads plugin when needed", async () => {
    const mockPlugin = vi.fn()
    const loadFn = vi.fn().mockResolvedValue({ default: mockPlugin })

    const { result } = renderHook(() =>
      useLazyPlugin({
        key: "katex",
        needed: true,
        load: loadFn,
        pluginName: "test-plugin",
      })
    )

    // Initially null
    expect(result.current).toBeNull()

    // Wait for the plugin to load
    await waitFor(() => {
      expect(result.current).toBe(mockPlugin)
    })

    expect(loadFn).toHaveBeenCalledTimes(1)
  })

  it("calls onBeforeLoad before loading", async () => {
    const mockPlugin = vi.fn()
    const loadFn = vi.fn().mockResolvedValue({ default: mockPlugin })
    const onBeforeLoad = vi.fn()

    renderHook(() =>
      useLazyPlugin({
        key: "raw",
        needed: true,
        load: loadFn,
        pluginName: "test-plugin",
        onBeforeLoad,
      })
    )

    await waitFor(() => {
      expect(onBeforeLoad).toHaveBeenCalled()
    })

    // onBeforeLoad should be called before load completes
    expect(onBeforeLoad).toHaveBeenCalled()
  })

  it("returns LOAD_FAILED when load fails", async () => {
    const loadFn = vi.fn().mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() =>
      useLazyPlugin({
        key: "emoji",
        needed: true,
        load: loadFn,
        pluginName: "test-plugin",
      })
    )

    await waitFor(() => {
      expect(result.current).toBe(LOAD_FAILED)
    })
  })

  it("does not reload when plugin is already loaded", async () => {
    const mockPlugin = vi.fn()
    const loadFn = vi.fn().mockResolvedValue({ default: mockPlugin })

    const { result, rerender } = renderHook(
      ({ needed }) =>
        useLazyPlugin({
          key: "katex",
          needed,
          load: loadFn,
          pluginName: "test-plugin",
        }),
      { initialProps: { needed: true } }
    )

    await waitFor(() => {
      expect(result.current).toBe(mockPlugin)
    })

    // Rerender with same props
    rerender({ needed: true })

    // Should not call load again
    expect(loadFn).toHaveBeenCalledTimes(1)
  })

  it("returns null when needed becomes false after plugin is loaded", async () => {
    const mockPlugin = vi.fn()
    const loadFn = vi.fn().mockResolvedValue({ default: mockPlugin })

    const { result, rerender } = renderHook(
      ({ needed }) =>
        useLazyPlugin({
          key: "raw",
          needed,
          load: loadFn,
          pluginName: "test-plugin",
        }),
      { initialProps: { needed: true } }
    )

    // Wait for plugin to load
    await waitFor(() => {
      expect(result.current).toBe(mockPlugin)
    })

    // Now set needed to false - should return null, not the stale plugin
    rerender({ needed: false })

    expect(result.current).toBeNull()
  })

  it("handles cleanup on unmount without errors", () => {
    const mockPlugin = vi.fn()
    let resolveLoad: (value: { default: typeof mockPlugin }) => void
    const loadFn = vi.fn().mockReturnValue(
      new Promise(resolve => {
        resolveLoad = resolve
      })
    )

    // Spy on console.error to detect React warnings about state updates on unmounted components
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const { unmount } = renderHook(() =>
      useLazyPlugin({
        key: "emoji",
        needed: true,
        load: loadFn,
        pluginName: "test-plugin",
      })
    )

    // Unmount before load completes
    unmount()

    // Resolve the load after unmount
    act(() => {
      resolveLoad({ default: mockPlugin })
    })

    // The hook should have cleaned up and not caused any React warnings
    // about updating state on an unmounted component
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("unmounted component")
    )
    consoleErrorSpy.mockRestore()
  })

  it("shares loading promise across concurrent hook instances", async () => {
    const mockPlugin = vi.fn()
    let resolveLoad: (value: { default: typeof mockPlugin }) => void
    const loadFn = vi.fn().mockReturnValue(
      new Promise(resolve => {
        resolveLoad = resolve
      })
    )

    // Render multiple hooks simultaneously with the same plugin key
    const { result: result1 } = renderHook(() =>
      useLazyPlugin({
        key: "katex",
        needed: true,
        load: loadFn,
        pluginName: "test-plugin",
      })
    )

    const { result: result2 } = renderHook(() =>
      useLazyPlugin({
        key: "katex",
        needed: true,
        load: loadFn,
        pluginName: "test-plugin",
      })
    )

    const { result: result3 } = renderHook(() =>
      useLazyPlugin({
        key: "katex",
        needed: true,
        load: loadFn,
        pluginName: "test-plugin",
      })
    )

    // All should be null initially (loading)
    expect(result1.current).toBeNull()
    expect(result2.current).toBeNull()
    expect(result3.current).toBeNull()

    // Load function should only be called once despite 3 concurrent requests
    expect(loadFn).toHaveBeenCalledTimes(1)

    // Resolve the shared promise
    act(() => {
      resolveLoad({ default: mockPlugin })
    })

    // All instances should receive the same loaded plugin
    await waitFor(() => {
      expect(result1.current).toBe(mockPlugin)
      expect(result2.current).toBe(mockPlugin)
      expect(result3.current).toBe(mockPlugin)
    })
  })
})

describe("PluginState type", () => {
  it("can hold a plugin function", () => {
    const plugin: PluginState<() => void> = () => {
      // no-op plugin for type test
    }
    expect(typeof plugin).toBe("function")
  })

  it("can hold null", () => {
    const plugin: PluginState<() => void> = null
    expect(plugin).toBeNull()
  })

  it("can hold LOAD_FAILED", () => {
    const plugin: PluginState<() => void> = LOAD_FAILED
    expect(plugin).toBe(LOAD_FAILED)
  })
})
