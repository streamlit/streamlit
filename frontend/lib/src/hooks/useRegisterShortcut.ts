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

import { isFromMac } from "~lib/util/utils"

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])
const MODIFIER_TOKENS = new Set(["ctrl", "cmd", "alt", "shift", "mod"])
const SYSTEM_MODIFIERS = new Set(["ctrl", "cmd", "alt", "mod"])

const MODIFIER_ORDER = ["ctrl", "cmd", "alt", "shift", "mod"] as const
const MODIFIER_DISPLAY: Record<(typeof MODIFIER_ORDER)[number], string> = {
  ctrl: "Ctrl",
  cmd: "⌘",
  alt: "Alt",
  shift: "Shift",
  mod: "Mod", // Placeholder, will be replaced by getModifierLabel
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

const NAVIGATION_KEYS = new Set([
  "left",
  "right",
  "up",
  "down",
  "home",
  "end",
  "pageup",
  "pagedown",
  "backspace",
  "delete",
])

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

/**
 * Ensure the hotkeys filter is configured.
 */
export function ensureHotkeysFilterConfigured(): void {
  // `hotkeys-js` uses a single global filter. Configure it once so that
  // shortcuts never fire while the user is typing in a text input unless a
  // system modifier is pressed (mirrors native browser behavior).
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

/**
 * Parse a shortcut string into its tokens.
 *
 * @param shortcut - The shortcut string to parse.
 * @returns The parsed shortcut tokens.
 */
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

/**
 * Determine if a shortcut should be blocked in an input element.
 *
 * @param parsedShortcut - The parsed shortcut tokens.
 * @param event - The keyboard event.
 * @returns True if the shortcut should be blocked, false otherwise.
 */
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
    // Modifier-only shortcuts are blocked in inputs.
    return true
  }

  if (baseKey.length === 1 && /^[a-z0-9]$/i.test(baseKey)) {
    return true
  }

  if (
    baseKey === "space" ||
    baseKey === "tab" ||
    baseKey === "enter" ||
    NAVIGATION_KEYS.has(baseKey)
  ) {
    // Prevent overriding default text-editing behavior (e.g. arrows, delete)
    // when the user has not pressed a system modifier.
    return true
  }

  return false
}

/**
 * Convert a list of shortcut tokens to a hotkeys sequence.
 *
 * @param tokens - The list of shortcut tokens.
 * @returns The hotkeys sequence.
 */
function toHotkeysSequenceFromTokens(tokens: string[]): string {
  return tokens.map(token => (token === "cmd" ? "command" : token)).join("+")
}

/**
 * Build the hotkeys sequences for a parsed shortcut.
 *
 * @param parsedShortcut - The parsed shortcut.
 * @returns The hotkeys sequences.
 */
function buildSequences(parsedShortcut?: ShortcutTokens): string[] {
  if (!parsedShortcut) {
    return []
  }

  const { tokens } = parsedShortcut
  const isMac = isFromMac()

  // Map both "cmd" and "ctrl" to the platform-specific primary modifier:
  // - Mac: "cmd"
  // - Windows/Linux: "ctrl"
  const primaryModifier = isMac ? "cmd" : "ctrl"

  const sequenceTokens = tokens.map(token =>
    token === "cmd" || token === "ctrl" || token === "mod"
      ? primaryModifier
      : token
  )

  // Deduplicate tokens (e.g. "Ctrl+Cmd+K" -> "Cmd+K" on Mac)
  const uniqueTokens = Array.from(new Set(sequenceTokens))

  return [toHotkeysSequenceFromTokens(uniqueTokens)]
}

/**
 * Get the label for a modifier.
 *
 * @param modifier - The modifier.
 * @param isMac - Whether the platform is Mac.
 * @returns The modifier label.
 */
function getModifierLabel(
  modifier: string,
  isMac: boolean
): string | undefined {
  if (modifier === "cmd") {
    return isMac ? MODIFIER_DISPLAY.cmd : MODIFIER_DISPLAY.ctrl
  }

  if (modifier === "ctrl") {
    return isMac ? MODIFIER_DISPLAY.cmd : MODIFIER_DISPLAY.ctrl
  }

  if (modifier === "mod") {
    return isMac ? MODIFIER_DISPLAY.cmd : MODIFIER_DISPLAY.ctrl
  }

  if (modifier === "alt" && isMac) {
    return "⌥"
  }

  return MODIFIER_DISPLAY[modifier as (typeof MODIFIER_ORDER)[number]]
}

/**
 * Get the label for a key.
 *
 * @param baseKey - The key.
 * @returns The key label.
 */
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

/**
 * Format a shortcut string for display.
 *
 * @param shortcut - The shortcut string to format.
 * @param options - The options for formatting.
 * @returns The formatted shortcut string.
 */
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

/**
 * Custom hook to register a keyboard shortcut.
 *
 * @param shortcut - The shortcut string to register.
 * @param disabled - Whether the shortcut is disabled.
 * @param onActivate - The function to call when the shortcut is activated.
 */
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
      // Clean up the exact handler instance registered above.
      sequences.forEach(sequence => {
        hotkeys.unbind(sequence, handler)
      })
    }
  }, [parsedShortcut, sequences, disabled, onActivate])
}
