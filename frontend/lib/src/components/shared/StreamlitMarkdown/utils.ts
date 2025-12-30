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

import { useEffect, useState } from "react"

import type { Root as HastRoot } from "hast"
import { once } from "lodash-es"
import type { Root as MdastRoot } from "mdast"
import type { VFile } from "vfile"

/**
 * Plugin type aliases derived from dynamic imports.
 * These represent the actual plugin functions after module resolution.
 */
export type KatexPlugin = Awaited<
  ReturnType<typeof loadKatexPlugin>
>["default"]
export type RawPlugin = Awaited<ReturnType<typeof loadRehypeRaw>>["default"]
export type EmojiPlugin = Awaited<
  ReturnType<typeof loadRemarkEmoji>
>["default"]

/** Sentinel value for failed plugin loads */
export const LOAD_FAILED = Symbol("plugin_load_failed")
export type FailedPlugin = typeof LOAD_FAILED

/** Represents a plugin's loading state: loaded, failed, or not yet attempted */
export type PluginState<T> = T | FailedPlugin | null

/** Keys for the plugin cache */
export type PluginKey = "katex" | "raw" | "emoji"

/** Union type for all supported plugin types */
type AnyPlugin = KatexPlugin | RawPlugin | EmojiPlugin

/** A rehype transformer function that processes an HTML AST tree */
type RehypeTransformer = (
  tree: HastRoot,
  file: VFile
) => HastRoot | undefined | void

/** A rehype plugin factory that returns a transformer when called with options */
type RehypePluginFactory<Options = unknown> = (
  options?: Options
) => RehypeTransformer

/** A remark transformer function that processes a Markdown AST tree */
type RemarkTransformer = (
  tree: MdastRoot,
  file: VFile
) => MdastRoot | undefined | void

/** A remark plugin factory that returns a transformer when called with options */
export type RemarkPluginFactory<Options = unknown> = (
  options?: Options
) => RemarkTransformer

/**
 * Configuration for the useLazyPlugin hook.
 *
 * Note: `load` and `onBeforeLoad` should be stable references (e.g., module-level
 * functions or wrapped in useCallback) to avoid unnecessary effect re-runs.
 */
export interface PluginLoaderConfig {
  key: PluginKey
  needed: boolean
  load: () => Promise<Record<string, unknown>>
  pluginName: string
  onBeforeLoad?: () => void
}

/**
 * Module-level cache for loaded plugins.
 * Shared across all component instances to avoid redundant loading.
 */
const pluginCache: Record<PluginKey, PluginState<AnyPlugin>> = {
  katex: null,
  raw: null,
  emoji: null,
}

/**
 * Module-level cache for in-flight loading promises.
 * Prevents duplicate loads when multiple components request the same plugin.
 */
const loadingPromises: Record<
  PluginKey,
  Promise<PluginState<AnyPlugin>> | null
> = {
  katex: null,
  raw: null,
  emoji: null,
}

/** Lazy load rehype-katex for math rendering */
export const loadKatexPlugin = (): Promise<typeof import("rehype-katex")> =>
  import("rehype-katex")

/** Load KaTeX CSS styles (only once per app lifecycle) */
export const loadKatexStyles = once((): void => {
  void import("katex/dist/katex.min.css")
})

/** Lazy load rehype-raw for HTML parsing (pulls in parse5) */
export const loadRehypeRaw = (): Promise<typeof import("rehype-raw")> =>
  import("rehype-raw")

/** Lazy load remark-emoji for emoji shortcode conversion */
export const loadRemarkEmoji = (): Promise<typeof import("remark-emoji")> =>
  import("remark-emoji")

/**
 * Type guard to check if a plugin was successfully loaded.
 */
export function isLoadedPlugin<T>(plugin: PluginState<T>): plugin is T {
  return plugin !== null && plugin !== LOAD_FAILED
}

/**
 * Extracts the plugin function from a dynamically imported module.
 * Handles various module shapes from different bundlers (nested default exports, etc.)
 */
export function extractPlugin<T>(
  module: Record<string, unknown>,
  pluginName: string
): PluginState<T> {
  const candidates: unknown[] = []
  let current: unknown = module
  let depth = 0

  // Unwrap nested default exports (some bundlers wrap modules multiple times)
  while (
    current &&
    typeof current === "object" &&
    "default" in (current as Record<string, unknown>) &&
    depth < 5
  ) {
    const next = (current as Record<string, unknown>).default
    candidates.push(next)
    if (next === current) {
      break
    }
    current = next
    depth += 1
  }

  candidates.push(module)

  // Find the first function candidate (the actual plugin)
  for (const candidate of candidates) {
    if (typeof candidate === "function") {
      return candidate as T
    }
  }

  // eslint-disable-next-line no-console -- Intentional warning for debugging plugin load failures
  console.warn(`[StreamlitMarkdown] Failed to load ${pluginName} plugin`)
  return LOAD_FAILED
}

/**
 * Wraps a rehype plugin to add error handling and guard against undefined trees.
 * If the plugin crashes during transformation, the original tree is returned,
 * allowing the content to render as plain text instead of breaking the component.
 */
export function wrapRehypePlugin<Options = unknown>(
  plugin: RehypePluginFactory<Options>,
  pluginName: string
): RehypePluginFactory<Options> {
  return (options?: Options): RehypeTransformer => {
    const transformer = plugin(options)

    return (tree: HastRoot, file: VFile): HastRoot | undefined | void => {
      if (!tree) {
        return tree
      }

      try {
        return transformer(tree, file)
      } catch (error) {
        // eslint-disable-next-line no-console -- Intentional error logging for debugging plugin crashes
        console.error(
          `[StreamlitMarkdown] ${pluginName} crashed while transforming`,
          error
        )
        return tree
      }
    }
  }
}

/**
 * Wraps a remark plugin to add error handling and guard against undefined trees.
 * If the plugin crashes during transformation, the original tree is returned,
 * allowing the content to render as plain text instead of breaking the component.
 */
export function wrapRemarkPlugin<Options = unknown>(
  plugin: RemarkPluginFactory<Options>,
  pluginName: string
): RemarkPluginFactory<Options> {
  return (options?: Options): RemarkTransformer => {
    const transformer = plugin(options)

    return (tree: MdastRoot, file: VFile): MdastRoot | undefined | void => {
      if (!tree) {
        return tree
      }

      try {
        return transformer(tree, file)
      } catch (error) {
        // eslint-disable-next-line no-console -- Intentional error logging for debugging plugin crashes
        console.error(
          `[StreamlitMarkdown] ${pluginName} crashed while transforming`,
          error
        )
        return tree
      }
    }
  }
}

/**
 * Custom hook for lazy loading markdown plugins with module-level caching.
 *
 * Handles the complexity of:
 * - Module-level caching to share plugins across component instances
 * - Shared in-flight promises to prevent duplicate loads
 * - React StrictMode compatibility (proper cleanup)
 * - Preventing React from calling plugin functions as state updaters
 *
 * @typeParam T - The plugin type, used for return type inference
 */
export function useLazyPlugin<T>(config: PluginLoaderConfig): PluginState<T> {
  const { key, needed, load, pluginName, onBeforeLoad } = config

  // Read from module-level cache during render - this is the source of truth.
  // This avoids the anti-pattern of syncing external state into local state via useEffect.
  const cachedPlugin = needed ? (pluginCache[key] as PluginState<T>) : null

  // Local state only tracks loading progress, not the final cached value
  const [loadingResult, setLoadingResult] = useState<PluginState<T>>(null)

  useEffect(() => {
    // Skip if not needed, already cached, or already have a loading result.
    // LOAD_FAILED is a truthy Symbol, so failed plugins are intentionally cached
    // and not retried - this prevents infinite retry loops on persistent failures.
    if (!needed || cachedPlugin || loadingResult) {
      return
    }

    // Check if another instance is already loading this plugin
    const existingPromise = loadingPromises[key]
    if (existingPromise) {
      let isCancelled = false
      void existingPromise.then(p => {
        if (!isCancelled) {
          // Wrap in arrow function to prevent React from calling the plugin
          setLoadingResult(() => p as PluginState<T>)
        }
      })
      return () => {
        isCancelled = true
      }
    }

    onBeforeLoad?.()

    let isCancelled = false
    const loadPromise = load()
      .then(module => extractPlugin<T>(module, pluginName))
      .then(extracted => {
        pluginCache[key] = extracted as PluginState<AnyPlugin>
        if (!isCancelled) {
          // Wrap in arrow function to prevent React from calling the plugin
          setLoadingResult(() => extracted)
        }
        return extracted
      })
      .catch(() => {
        const failed = LOAD_FAILED as PluginState<T>
        pluginCache[key] = failed as PluginState<AnyPlugin>
        if (!isCancelled) {
          setLoadingResult(() => failed)
        }
        return failed
      })
      .finally(() => {
        loadingPromises[key] = null
      }) as Promise<PluginState<T>>

    loadingPromises[key] = loadPromise as Promise<PluginState<AnyPlugin>>

    return () => {
      isCancelled = true
    }
  }, [
    needed,
    cachedPlugin,
    loadingResult,
    key,
    load,
    pluginName,
    onBeforeLoad,
  ])

  if (!needed) {
    return null
  }

  // Return cached plugin (source of truth) if available, otherwise loading result
  return cachedPlugin ?? loadingResult
}

/**
 * Resets the plugin cache and loading promises.
 * @internal Only exported for testing - do not use in production code.
 */
export function _resetCacheForTesting(): void {
  pluginCache.katex = null
  pluginCache.raw = null
  pluginCache.emoji = null
  loadingPromises.katex = null
  loadingPromises.raw = null
  loadingPromises.emoji = null
}
