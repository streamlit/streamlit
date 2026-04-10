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

import { RefObject, useEffect, useMemo, useRef, useState } from "react"

import { debounce } from "lodash-es"
import { getLogger } from "loglevel"

import { WidgetStateManager } from "~lib/WidgetStateManager"

import type {
  PerspectiveClient,
  PerspectiveTable,
  PerspectiveViewerElement,
} from "./types"

const LOG = getLogger("usePerspective")

/** Debounce time for saving viewer state */
const STATE_SAVE_DEBOUNCE_MS = 150

/** Perspective viewer config state saved to element state */
interface PerspectiveViewerState {
  config?: Record<string, unknown>
}

interface UsePerspectiveProps {
  elementId: string
  arrowData: Uint8Array
  defaultConfigJson?: string
  theme: string
  schemaDigest: string
  widgetMgr: WidgetStateManager
}

interface UsePerspectiveReturn {
  viewerRef: RefObject<PerspectiveViewerElement | null>
  isInitialized: boolean
  error: Error | null
}

/** Global promise for WASM initialization - ensures single init across all instances */
let wasmInitPromise: Promise<PerspectiveClient> | null = null

/**
 * Initialize Perspective WASM modules.
 * This only needs to happen once per page load.
 * Returns a client connected to a web worker.
 */
async function initializePerspective(): Promise<PerspectiveClient> {
  if (wasmInitPromise) {
    return wasmInitPromise
  }

  wasmInitPromise = (async () => {
    // Dynamically import WASM URLs using Vite's ?url import syntax
    // These imports return { default: string } where the string is the URL
    const [
      serverWasmModule,
      clientWasmModule,
      viewerWasmModule,
      perspectiveClient,
      perspectiveViewer,
    ] = await Promise.all([
      import("@perspective-dev/server/dist/wasm/perspective-server.wasm?url"),
      import("@perspective-dev/client/dist/wasm/perspective-js.wasm?url"),
      import("@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm?url"),
      import("@perspective-dev/client"),
      import("@perspective-dev/viewer"),
    ])

    const serverWasmUrl = serverWasmModule.default
    const clientWasmUrl = clientWasmModule.default
    const viewerWasmUrl = viewerWasmModule.default

    // Initialize all WASM modules
    // Note: init_server and init_client are synchronous but may need the WASM to be fetched
    perspectiveClient.init_server(fetch(serverWasmUrl))
    perspectiveClient.init_client(fetch(clientWasmUrl))
    await perspectiveViewer.init_client(fetch(viewerWasmUrl))

    // Import and register plugins
    await Promise.all([
      import("@perspective-dev/viewer-datagrid"),
      import("@perspective-dev/viewer-d3fc"),
    ])

    LOG.info("Perspective WASM initialized successfully")

    // Create and return a worker client
    const client = await perspectiveClient.worker()
    return client as PerspectiveClient
  })()

  return wasmInitPromise
}

/**
 * Hook that manages Perspective viewer initialization, data loading, and state persistence.
 */
export function usePerspective({
  elementId,
  arrowData,
  defaultConfigJson,
  theme,
  schemaDigest,
  widgetMgr,
}: UsePerspectiveProps): UsePerspectiveReturn {
  const viewerRef = useRef<PerspectiveViewerElement | null>(null)
  const tableRef = useRef<PerspectiveTable | null>(null)
  const clientRef = useRef<PerspectiveClient | null>(null)
  const prevSchemaDigestRef = useRef<string | null>(null)

  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Parse default config if provided
  const defaultConfig = useMemo(
    () =>
      defaultConfigJson
        ? (JSON.parse(defaultConfigJson) as Record<string, unknown>)
        : undefined,
    [defaultConfigJson]
  )

  /**
   * Save the viewer state to element state for persistence across remounts.
   * This function is debounced and called from the config update event handler.
   */
  const saveViewerState = useMemo(
    () =>
      debounce(async (viewer: PerspectiveViewerElement) => {
        try {
          const config = await viewer.save()
          const state: PerspectiveViewerState = { config }
          widgetMgr.setElementState(elementId, "viewerState", state)
          LOG.debug("Saved Perspective viewer state")
        } catch (err) {
          LOG.error("Failed to save viewer state:", err)
        }
      }, STATE_SAVE_DEBOUNCE_MS),
    [elementId, widgetMgr]
  )

  /**
   * Initialize the viewer and load data.
   */
  useEffect(() => {
    let mounted = true
    let currentViewer: PerspectiveViewerElement | null = null
    let configUpdateHandler: (() => void) | null = null

    const setup = async (): Promise<void> => {
      try {
        // Initialize WASM and get client if not already done
        const client = await initializePerspective()
        clientRef.current = client

        if (!mounted || !viewerRef.current) {
          return
        }

        const viewer = viewerRef.current
        currentViewer = viewer

        // Check if schema changed (requires viewer reset)
        const schemaChanged =
          prevSchemaDigestRef.current !== null &&
          prevSchemaDigestRef.current !== schemaDigest
        prevSchemaDigestRef.current = schemaDigest

        // Get saved state from widget manager
        const savedState = widgetMgr.getElementState<PerspectiveViewerState>(
          elementId,
          "viewerState"
        )

        if (tableRef.current && !schemaChanged) {
          // Update existing table with new data (same schema)
          // Perspective can load Arrow IPC data directly from Uint8Array
          await tableRef.current.replace(arrowData)
          LOG.debug("Updated Perspective table with new data")
        } else {
          // Create new table
          if (tableRef.current) {
            // Clean up old table
            await tableRef.current.delete()
          }

          // Create a new table from Arrow IPC data
          // Perspective can directly consume Uint8Array of Arrow IPC
          tableRef.current = await client.table(arrowData)

          // Load table into viewer
          await viewer.load(tableRef.current)

          // Apply configuration
          if (schemaChanged || !savedState?.config) {
            // Schema changed or no saved state - apply default config
            if (defaultConfig) {
              await viewer.restore(defaultConfig)
            }
          } else if (savedState?.config) {
            // Restore saved state
            await viewer.restore(savedState.config)
          }

          LOG.debug("Created new Perspective table")
        }

        // Set up config change listener
        configUpdateHandler = (): void => {
          void saveViewerState(viewer)
        }
        // eslint-disable-next-line @eslint-react/web-api/no-leaked-event-listener -- cleanup is in effect return, linter can't trace through async
        viewer.addEventListener(
          "perspective-config-update",
          configUpdateHandler
        )

        // Apply theme
        if (theme === "streamlit") {
          // Use Perspective's default theme for now
          // TODO: Create a Streamlit-specific theme
          await viewer.resetThemes([])
        } else if (theme) {
          await viewer.resetThemes([theme])
        }

        if (mounted) {
          setIsInitialized(true)
          setError(null)
        }
      } catch (err) {
        LOG.error("Failed to initialize Perspective:", err)
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }

    void setup()

    return () => {
      mounted = false
      // Clean up event listener using the captured viewer reference
      if (configUpdateHandler && currentViewer) {
        currentViewer.removeEventListener(
          "perspective-config-update",
          configUpdateHandler
        )
      }
    }
  }, [
    arrowData,
    defaultConfig,
    elementId,
    saveViewerState,
    schemaDigest,
    theme,
    widgetMgr,
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tableRef.current) {
        void tableRef.current.delete()
        tableRef.current = null
      }
    }
  }, [])

  return {
    viewerRef,
    isInitialized,
    error,
  }
}
