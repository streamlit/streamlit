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

/**
 * Hook to register keyboard shortcuts for buttons and related elements.
 */

import { useEffect, useMemo } from "react"

import hotkeys, { HotkeysEvent } from "hotkeys-js"

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])
const MODIFIER_TOKENS = new Set(["ctrl", "cmd", "alt", "shift"])
const SYSTEM_MODIFIERS = new Set(["ctrl", "cmd", "alt"])

const MODIFIER_ORDER = ["ctrl", "cmd", "alt", "shift"] as const
const MODIFIER_DISPLAY: Record<(typeof MODIFIER_ORDER)[number], string> = {
  ctrl: "Ctrl",
  cmd: "Cmd",
  alt: "Alt",
  shift: "Shift",
}

const KEY_DISPLAY: Record<string, string> = {
  enter: "Enter",
  space: "Space",
  tab: "Tab",
  escape: "Esc",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
}

interface ShortcutTokens {
  tokens: string[]
  baseKey?: string
  hasSystemModifier: boolean
}

interface UseRegisterShortcutOptions {
  shortcut?: string | null
  disabled?: boolean
  onActivate: () => void
}

let filterConfigured = false

function ensureHotkeysFilterConfigured(): void {
  if (filterConfigured) {
    return
  }

  hotkeys.filter = event => {
    const target = (event.target || event.srcElement) as HTMLElement | null
    if (!target) {
      return true
    }

    const tagName = target.tagName
    const isEditable =
      EDITABLE_TAGS.has(tagName) || Boolean(target.isContentEditable)

    if (!isEditable) {
      return true
    }

    if (event.key === "Escape") {
      return true
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return true
    }

    if (event.shiftKey) {
      const key = event.key ?? ""
      if (key.length > 1 && !/^[a-z0-9]$/i.test(key)) {
        return true
      }
    }

    return false
  }

  filterConfigured = true
}

export function parseShortcutString(
  shortcut?: string | null
): ShortcutTokens | undefined {
  if (!shortcut) {
    return undefined
  }

  const tokens = shortcut
    .split("+")
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)

  if (tokens.length === 0) {
    return undefined
  }

  let baseKey: string | undefined
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index]
    if (!MODIFIER_TOKENS.has(token)) {
      baseKey = token
      break
    }
  }

  const hasSystemModifier = tokens.some(token => SYSTEM_MODIFIERS.has(token))

  return { tokens, baseKey, hasSystemModifier }
}

function shouldBlockShortcutInInput(
  parsedShortcut: ShortcutTokens,
  event: KeyboardEvent
): boolean {
  const target = (event.target || event.srcElement) as HTMLElement | null
  if (!target) {
    return false
  }

  const isEditable =
    EDITABLE_TAGS.has(target.tagName) || Boolean(target.isContentEditable)
  if (!isEditable) {
    return false
  }

  if (parsedShortcut.hasSystemModifier) {
    return false
  }

  const baseKey = parsedShortcut.baseKey
  if (!baseKey) {
    // Modifier-only shortcuts are allowed.
    return false
  }

  if (baseKey.length === 1 && /^[a-z0-9]$/i.test(baseKey)) {
    return true
  }

  if (baseKey === "space" || baseKey === "tab" || baseKey === "enter") {
    return true
  }

  return false
}

function toHotkeysSequenceFromTokens(tokens: string[]): string {
  return tokens.map(token => (token === "cmd" ? "command" : token)).join("+")
}

function buildSequences(parsedShortcut?: ShortcutTokens): string[] {
  if (!parsedShortcut) {
    return []
  }

  const sequences = new Set<string>()
  sequences.add(toHotkeysSequenceFromTokens(parsedShortcut.tokens))

  if (parsedShortcut.tokens.includes("cmd")) {
    const aliasTokens = parsedShortcut.tokens.map(token =>
      token === "cmd" ? "ctrl" : token
    )
    sequences.add(toHotkeysSequenceFromTokens(aliasTokens))
  }

  return Array.from(sequences)
}

function getModifierLabel(
  modifier: string,
  isMac: boolean
): string | undefined {
  if (modifier === "cmd") {
    return isMac ? MODIFIER_DISPLAY.cmd : MODIFIER_DISPLAY.ctrl
  }

  if (modifier === "alt" && isMac) {
    return "Option"
  }

  return MODIFIER_DISPLAY[modifier as (typeof MODIFIER_ORDER)[number]]
}

function getKeyLabel(baseKey: string): string {
  if (KEY_DISPLAY[baseKey]) {
    return KEY_DISPLAY[baseKey]
  }

  if (baseKey.length === 1) {
    return baseKey.toUpperCase()
  }

  if (baseKey.startsWith("f") && /^\d+$/.test(baseKey.slice(1))) {
    return baseKey.toUpperCase()
  }

  return baseKey.toUpperCase()
}

export function formatShortcutForDisplay(
  shortcut?: string | null,
  options?: { isMac?: boolean }
): string | undefined {
  const parsedShortcut = parseShortcutString(shortcut)
  if (!parsedShortcut) {
    return undefined
  }

  const isMac = options?.isMac ?? false

  const displayTokens: string[] = []
  MODIFIER_ORDER.forEach(modifier => {
    if (parsedShortcut.tokens.includes(modifier)) {
      const label = getModifierLabel(modifier, isMac)
      if (label) {
        displayTokens.push(label)
      }
    }
  })

  if (parsedShortcut.baseKey) {
    displayTokens.push(getKeyLabel(parsedShortcut.baseKey))
  }

  if (displayTokens.length === 0) {
    return undefined
  }

  return displayTokens.join(" + ")
}

export function useRegisterShortcut({
  shortcut,
  disabled = false,
  onActivate,
}: UseRegisterShortcutOptions): void {
  const parsedShortcut = useMemo(
    () => parseShortcutString(shortcut),
    [shortcut]
  )
  const sequences = useMemo(
    () => buildSequences(parsedShortcut),
    [parsedShortcut]
  )

  useEffect(() => {
    ensureHotkeysFilterConfigured()
  }, [])

  useEffect(() => {
    if (!parsedShortcut || sequences.length === 0 || disabled) {
      return
    }

    const handler = (
      keyboardEvent: KeyboardEvent,
      _event: HotkeysEvent
    ): void => {
      if (disabled) {
        return
      }

      if (shouldBlockShortcutInInput(parsedShortcut, keyboardEvent)) {
        return
      }

      keyboardEvent.preventDefault()
      onActivate()
    }

    sequences.forEach(sequence => {
      hotkeys(sequence, handler)
    })

    return () => {
      sequences.forEach(sequence => {
        hotkeys.unbind(sequence, handler)
      })
    }
  }, [parsedShortcut, sequences, disabled, onActivate])
}
