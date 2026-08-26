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

import { ReactElement, ReactNode, useEffect, useRef } from "react"

import { isKeyboardEventFromEditableTarget } from "@streamlit/lib"

type HotkeyHandler = (keyName: string, event?: KeyboardEvent) => void

interface GlobalHotkeysProps {
  /** Comma-separated keys to listen for, for example `"r,c,esc"`. */
  keyName: string
  onKeyDown?: HotkeyHandler
  onKeyUp?: HotkeyHandler
  children: ReactNode
}

function normalizeKey(key: string): string {
  return key === "Escape" || key === "Esc" ? "esc" : key.toLowerCase()
}

/** Handles Streamlit's unmodified, single-key global shortcuts. */
export function GlobalHotkeys({
  keyName,
  onKeyDown,
  onKeyUp,
  children,
}: GlobalHotkeysProps): ReactElement {
  const keyDownHandlerRef = useRef(onKeyDown)
  const keyUpHandlerRef = useRef(onKeyUp)
  keyDownHandlerRef.current = onKeyDown
  keyUpHandlerRef.current = onKeyUp

  useEffect(() => {
    const configuredKeys = new Set(
      keyName.split(",").map(key => normalizeKey(key.trim()))
    )
    // Held keys are tracked so a repeated or stuck keydown cannot retrigger
    // until keyup or the window loses focus.
    const activeKeys = new Set<string>()

    const handleKeyDown = (event: KeyboardEvent): void => {
      const normalizedKey = normalizeKey(event.key)
      // Shift is allowed so advertised shortcuts like R and C still work.
      const hasModifier = event.altKey || event.ctrlKey || event.metaKey
      if (
        !configuredKeys.has(normalizedKey) ||
        activeKeys.has(normalizedKey) ||
        event.repeat ||
        hasModifier ||
        isKeyboardEventFromEditableTarget(event)
      ) {
        return
      }

      activeKeys.add(normalizedKey)
      keyDownHandlerRef.current?.(normalizedKey, event)
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      const normalizedKey = normalizeKey(event.key)
      if (!activeKeys.delete(normalizedKey)) {
        return
      }

      keyUpHandlerRef.current?.(normalizedKey, event)
    }

    const handleWindowBlur = (): void => {
      activeKeys.clear()
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleWindowBlur)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleWindowBlur)
    }
  }, [keyName])

  return <>{children}</>
}
