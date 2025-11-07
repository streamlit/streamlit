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

import React, { useEffect, useMemo, useRef } from "react"

import { v4 as uuidv4 } from "uuid"

import {
  ComponentArgs,
  ComponentState,
  OptionalComponentCleanupFunction,
} from "@streamlit/component-v2-lib"

import { BidiComponentContext } from "~lib/components/widgets/BidiComponent/BidiComponentContext"
import { blobUrlManager } from "~lib/components/widgets/BidiComponent/utils/blobUrl"
import {
  handleError,
  normalizeError,
} from "~lib/components/widgets/BidiComponent/utils/error"
import { makeTriggerAggregatorId } from "~lib/components/widgets/BidiComponent/utils/idBuilder"
import { LOG } from "~lib/components/widgets/BidiComponent/utils/logger"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

/**
 * Security model
 * ----------------
 * This hook executes JavaScript authored by users or third parties as part of a
 * Custom Component v2 instance. Streamlit does not sanitize or validate this
 * content and makes no guarantees about what is executed. Inline JS is loaded
 * via a Blob URL and external files via a module script; both run with normal
 * DOM privileges.
 *
 * If you need to handle untrusted input, do not use this function without your
 * own sanitization/defense-in-depth strategy.
 */
const loadAndRunModule = async <T extends ComponentState>({
  componentId,
  componentIdForWidgetMgr,
  componentName,
  data,
  formId,
  fragmentId,
  getWidgetValue,
  moduleUrl,
  parentElement,
  widgetMgr,
}: {
  componentId: string
  componentIdForWidgetMgr: string
  componentName: string
  data: unknown
  getWidgetValue: () => T
  formId: string | undefined
  fragmentId: string | undefined
  moduleUrl: string
  parentElement: HTMLElement | ShadowRoot
  widgetMgr: WidgetStateManager
}): Promise<OptionalComponentCleanupFunction> => {
  const module = await import(/* @vite-ignore */ moduleUrl)

  if (!module) {
    throw new Error("JS module does not exist.")
  }

  if (!module.default || typeof module.default !== "function") {
    throw new Error("JS module does not have a default export function.")
  }

  const setStateValue = <T extends ComponentState>(
    name: string,
    value: T[keyof T]
  ): void => {
    let newValue: T = {} as T

    try {
      const existingValue = getWidgetValue()

      newValue = { ...existingValue, [name]: value } as T
    } catch (error) {
      LOG.error(`Failed to get existing value for ${name}`, error)
      newValue = { [name]: value } as T
    }

    void widgetMgr.setJsonValue(
      { id: componentIdForWidgetMgr, formId },
      newValue,
      { fromUi: true },
      fragmentId
    )
  }

  const setTriggerValue = <T extends ComponentState>(
    name: string,
    value: T[keyof T]
  ): void => {
    // IMPORTANT: Triggers are not allowed inside forms in Streamlit's execution
    // model. Native buttons cannot be placed in forms, and form semantics defer
    // updates until submit. To align CCv2 with existing behavior without
    // changing global runtime semantics, we no-op trigger calls when the
    // component is rendered inside a form. Developers should use setStateValue
    // and the form submit button to commit changes.
    if (formId) {
      LOG.warn(
        "BidiComponent: setTriggerValue ignored inside st.form. Triggers are not allowed in forms; use setStateValue and form submit instead."
      )
      return
    }
    const triggerId = makeTriggerAggregatorId(componentIdForWidgetMgr)
    void widgetMgr.setTriggerValue(
      { id: triggerId, formId },
      { fromUi: true },
      fragmentId,
      { event: name, value }
    )
  }

  return module.default({
    name: componentName,
    data,
    key: componentId,
    parentElement,
    setStateValue,
    setTriggerValue,
  } satisfies ComponentArgs)
}

/**
 * Load and execute CCv2 JavaScript for a component instance.
 *
 * Purpose
 * -------
 * Loads either inline JS (via Blob URL) or an external JS module URL and
 * executes its default export to bootstrap a Custom Component v2 instance.
 * Provides helpers for state updates and trigger events and wires errors into
 * the component error surface.
 *
 * Security model
 * --------------
 * - Executes author-provided JavaScript with normal DOM privileges. Streamlit
 *   does not sanitize or validate this code. Inline sources are loaded via a
 *   Blob URL; external sources use a `<script type="module">` element and
 *   dynamic `import()`.
 * - Treat this as trusted code execution. If you must handle untrusted input,
 *   sandbox or otherwise constrain execution yourself.
 *
 * When to use
 * -----------
 * - In CCv2 to initialize a component's runtime JS and integrate with
 *   Streamlit's widget state management and trigger system.
 *
 * When NOT to use
 * ---------------
 * - Outside of the CCv2 lifecycle.
 * - For arbitrary user-supplied JavaScript or content requiring isolation.
 *
 * @param containerRef - Parent `HTMLElement` or `ShadowRoot` where the module
 *   can attach its UI.
 * @param setError - Callback to report load/execute errors.
 * @param skip - When true, skip loading/executing for this effect cycle.
 */
export const useHandleJsContent = ({
  containerRef,
  setError,
  skip = false,
}: {
  containerRef: React.RefObject<HTMLElement | ShadowRoot>
  setError: (error: Error) => void
  skip?: boolean
}): void => {
  const thisUuid = useMemo(() => uuidv4(), [])
  const componentId = `st-bidi-component-${thisUuid}`

  const {
    componentName,
    data,
    formId,
    fragmentId,
    getWidgetValue,
    id,
    jsContent: inlineJsContent,
    jsSourcePath,
    theme,
    widgetMgr,
    componentRegistry: { getBidiComponentURL },
  } = useRequiredContext(BidiComponentContext)

  const externalJsSourcePathUrl = useMemo(() => {
    if (!jsSourcePath) {
      return undefined
    }
    return getBidiComponentURL(componentName, jsSourcePath)
  }, [componentName, jsSourcePath, getBidiComponentURL])

  // Lifecycle refs to ensure we only run the user-written JS cleanup function
  // when the component is unmounted by Streamlit.
  const cleanupRef = useRef<OptionalComponentCleanupFunction>()
  const scriptElementRef = useRef<HTMLScriptElement>()
  const unmountedRef = useRef(false)

  // Initialization/update effect: runs when inputs change
  useEffect(() => {
    const { current: containerRefCurrent } = containerRef
    if (
      skip ||
      (!inlineJsContent && !externalJsSourcePathUrl) ||
      !containerRefCurrent
    ) {
      return
    }

    const run = async (): Promise<void> => {
      try {
        if (inlineJsContent) {
          const { url } = blobUrlManager.getOrCreateUrlForJs(
            inlineJsContent,
            `st-bidi-${componentName}`
          )

          cleanupRef.current = await loadAndRunModule({
            componentId,
            componentIdForWidgetMgr: id,
            componentName,
            data,
            formId,
            fragmentId,
            getWidgetValue,
            moduleUrl: url,
            parentElement: containerRefCurrent,
            widgetMgr,
          })
        } else if (externalJsSourcePathUrl) {
          const scriptUrl = externalJsSourcePathUrl

          try {
            // Load the script
            await new Promise<void>((resolve, reject) => {
              const scriptElement = document.createElement("script")
              scriptElement.type = "module"
              scriptElement.src = scriptUrl
              scriptElement.async = true
              scriptElement.onload = () => resolve()
              scriptElement.onerror = () =>
                reject(
                  new Error(
                    `Failed to load script from ${externalJsSourcePathUrl}`
                  )
                )
              document.head.appendChild(scriptElement)
              scriptElementRef.current = scriptElement
            })

            // Run the module and store the cleanup function
            cleanupRef.current = await loadAndRunModule({
              componentId,
              componentIdForWidgetMgr: id,
              componentName,
              data,
              formId,
              fragmentId,
              getWidgetValue,
              moduleUrl: scriptUrl,
              parentElement: containerRefCurrent,
              widgetMgr,
            })
          } catch (error) {
            throw normalizeError(
              error,
              `Failed to load or execute script from ${externalJsSourcePathUrl}`
            )
          }
        }
      } catch (error) {
        if (!unmountedRef.current) {
          handleError(error, setError)
        }
      }
    }

    void run()
  }, [
    componentId,
    componentName,
    containerRef,
    data,
    formId,
    fragmentId,
    getWidgetValue,
    id,
    inlineJsContent,
    externalJsSourcePathUrl,
    setError,
    skip,
    widgetMgr,
    // We want to re-run the JS content on theme changes to ensure that any
    // theme-dependent JS logic can be applied at the proper lifecycle time.
    theme,
  ])

  // Unmount-only cleanup effect
  useEffect(() => {
    return () => {
      unmountedRef.current = true

      const maybeCleanup = cleanupRef.current
      if (maybeCleanup) {
        void Promise.resolve(maybeCleanup)
          .then(result => {
            result?.()
          })
          .catch(error => {
            LOG.error("Failed to run custom component cleanup", error)
          })
      }

      const scriptElement = scriptElementRef.current
      if (scriptElement?.parentNode) {
        scriptElement.parentNode.removeChild(scriptElement)
      }
    }
  }, [])
}
