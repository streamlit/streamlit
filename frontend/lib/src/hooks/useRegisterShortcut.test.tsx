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
 * Tests for the useRegisterShortcut hook.
 */

import React, { act, ReactElement } from "react"

import * as hotkeysModule from "hotkeys-js"
import { Mock, vi } from "vitest"

import { render } from "~lib/test_util"
import * as Utils from "~lib/util/utils"

import {
  ensureHotkeysFilterConfigured,
  formatShortcutForDisplay,
  isKeyboardEventFromEditableTarget,
  useRegisterShortcut,
} from "./useRegisterShortcut"

vi.mock("~lib/util/utils", async () => {
  const actual = await vi.importActual<typeof Utils>("~lib/util/utils")
  return {
    ...actual,
    isFromMac: vi.fn(),
  }
})

vi.mock("hotkeys-js", () => {
  const handlers = new Map<
    string,
    (keyboardEvent: KeyboardEvent, handler: unknown) => void
  >()

  const hotkeysMock = (
    keys: string,
    callback: (keyboardEvent: KeyboardEvent, handler: unknown) => void
  ): void => {
    handlers.set(keys, callback)
  }

  hotkeysMock.unbind = (
    keys: string,
    callback: (keyboardEvent: KeyboardEvent, handler: unknown) => void
  ): void => {
    const existing = handlers.get(keys)
    if (existing === callback) {
      handlers.delete(keys)
    }
  }

  let filterFn: (event: KeyboardEvent) => boolean = () => true
  Object.defineProperty(hotkeysMock, "filter", {
    get: () => filterFn,
    set: (value: (event: KeyboardEvent) => boolean) => {
      filterFn = value
    },
  })

  return {
    __esModule: true,
    default: hotkeysMock,
    __handlers: handlers,
    HotkeysEvent: class HotkeysEvent {},
  }
})

interface TestComponentProps {
  shortcut?: string | null
  disabled?: boolean
  onActivate: () => void
}

const hotkeysWithHandlers = hotkeysModule as typeof hotkeysModule & {
  __handlers: Map<
    string,
    (keyboardEvent: KeyboardEvent, handler: unknown) => void
  >
}

const TestComponent = ({
  shortcut,
  disabled,
  onActivate,
}: TestComponentProps): ReactElement => {
  useRegisterShortcut({ shortcut, disabled, onActivate })
  return <div>Shortcut test</div>
}

const createKeyboardEvent = (
  overrides: Partial<KeyboardEvent> = {}
): KeyboardEvent =>
  ({
    key: "k",
    preventDefault: vi.fn(),
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: document.body,
    ...overrides,
  }) as unknown as KeyboardEvent

describe("isKeyboardEventFromEditableTarget", () => {
  it("returns false when no event is passed", () => {
    expect(isKeyboardEventFromEditableTarget()).toBe(false)
  })

  it("returns false for events targeting non-editable elements", () => {
    const div = document.createElement("div")
    const event = createKeyboardEvent({ target: div })

    expect(isKeyboardEventFromEditableTarget(event)).toBe(false)
  })

  it.each(["input", "textarea", "select"])(
    "returns true for events targeting %s elements",
    tagName => {
      const element = document.createElement(tagName)
      const event = createKeyboardEvent({ target: element })

      expect(isKeyboardEventFromEditableTarget(event)).toBe(true)
    }
  )

  it("returns true for events targeting contentEditable elements", () => {
    const div = document.createElement("div")
    div.setAttribute("contenteditable", "true")

    const event = createKeyboardEvent({ target: div })

    expect(isKeyboardEventFromEditableTarget(event)).toBe(true)
  })

  it("returns true when the editable element appears in the composed path (shadow DOM)", () => {
    const hostDiv = document.createElement("div")
    const input = document.createElement("input")

    const event = createKeyboardEvent({
      target: hostDiv,
    }) as KeyboardEvent & { composedPath?: () => EventTarget[] }

    event.composedPath = () => [input, hostDiv, document.body]

    expect(isKeyboardEventFromEditableTarget(event)).toBe(true)
  })

  it("returns false when composedPath is empty or undefined and target is not editable", () => {
    const hostDiv = document.createElement("div")

    const eventWithEmptyPath = createKeyboardEvent({
      target: hostDiv,
    }) as KeyboardEvent & { composedPath?: () => EventTarget[] }
    eventWithEmptyPath.composedPath = () => []

    expect(isKeyboardEventFromEditableTarget(eventWithEmptyPath)).toBe(false)

    const eventWithoutPath = createKeyboardEvent({
      target: hostDiv,
    })

    expect(isKeyboardEventFromEditableTarget(eventWithoutPath)).toBe(false)
  })
})

describe("useRegisterShortcut", () => {
  afterEach(() => {
    vi.clearAllMocks()
    hotkeysWithHandlers.__handlers.clear()
  })

  it("registers shortcut handlers", () => {
    const shortcut = "ctrl+k"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={false}
        onActivate={onActivate}
      />
    )

    const handler = hotkeysWithHandlers.__handlers.get("ctrl+k")
    expect(handler).toBeDefined()

    act(() => {
      handler?.(createKeyboardEvent({ ctrlKey: true }), {})
    })

    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it("does not trigger when shortcut is disabled", () => {
    const shortcut = "ctrl+k"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={true}
        onActivate={onActivate}
      />
    )

    const handler = hotkeysWithHandlers.__handlers.get("ctrl+k")
    expect(handler).toBeUndefined()
  })

  it("prevents activation when typing in text inputs without modifiers", () => {
    const shortcut = "n"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={false}
        onActivate={onActivate}
      />
    )

    const input = document.createElement("input")
    const handler = hotkeysWithHandlers.__handlers.get("n")
    expect(handler).toBeDefined()

    act(() => {
      handler?.(createKeyboardEvent({ target: input }), {})
    })

    expect(onActivate).not.toHaveBeenCalled()
  })

  it("configures hotkeys filter to ignore unmodified shortcuts in editable elements, including shadow DOM", () => {
    ensureHotkeysFilterConfigured()

    const hotkeys = hotkeysModule.default as typeof hotkeysModule.default & {
      filter: (event: KeyboardEvent) => boolean
    }

    const hostDiv = document.createElement("div")
    const input = document.createElement("input")

    const baseEvent = createKeyboardEvent({
      key: "c",
      target: hostDiv,
    }) as KeyboardEvent & { composedPath?: () => EventTarget[] }

    baseEvent.composedPath = () => [input, hostDiv, document.body]

    // Unmodified character key inside an input should be blocked.
    expect(hotkeys.filter(baseEvent)).toBe(false)

    // With a system modifier, the shortcut should be allowed.
    const modifiedEvent = createKeyboardEvent({
      key: "c",
      target: hostDiv,
      ctrlKey: true,
    }) as KeyboardEvent & { composedPath?: () => EventTarget[] }
    modifiedEvent.composedPath = () => [input, hostDiv, document.body]

    expect(hotkeys.filter(modifiedEvent)).toBe(true)
  })

  it("prevents activation when typing inside shadow DOM inputs without modifiers", () => {
    const shortcut = "n"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={false}
        onActivate={onActivate}
      />
    )

    const hostDiv = document.createElement("div")
    const input = document.createElement("input")
    const handler = hotkeysWithHandlers.__handlers.get("n")
    expect(handler).toBeDefined()

    const event = createKeyboardEvent({
      target: hostDiv,
    }) as unknown as KeyboardEvent & { composedPath: () => EventTarget[] }

    event.composedPath = () => [input, hostDiv, document.body]

    act(() => {
      handler?.(event, {})
    })

    expect(onActivate).not.toHaveBeenCalled()
  })

  it("prevents navigation shortcuts from firing in text inputs without modifiers", () => {
    const shortcut = "left"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={false}
        onActivate={onActivate}
      />
    )

    const input = document.createElement("input")
    const handler = hotkeysWithHandlers.__handlers.get("left")
    expect(handler).toBeDefined()

    act(() => {
      handler?.(createKeyboardEvent({ target: input, key: "ArrowLeft" }), {})
    })

    expect(onActivate).not.toHaveBeenCalled()
  })

  it("allows navigation shortcuts with system modifiers in text inputs", () => {
    const shortcut = "ctrl+left"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={false}
        onActivate={onActivate}
      />
    )

    const input = document.createElement("input")
    const handler = hotkeysWithHandlers.__handlers.get("ctrl+left")
    expect(handler).toBeDefined()

    act(() => {
      handler?.(
        createKeyboardEvent({
          target: input,
          ctrlKey: true,
          key: "ArrowLeft",
        }),
        {}
      )
    })

    expect(onActivate).toHaveBeenCalled()
  })

  it("registers command shortcut as Cmd on Mac", () => {
    ;(Utils.isFromMac as Mock).mockReturnValue(true)
    const shortcut = "cmd+n"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={false}
        onActivate={onActivate}
      />
    )

    const commandHandler = hotkeysWithHandlers.__handlers.get("command+n")
    const ctrlHandler = hotkeysWithHandlers.__handlers.get("ctrl+n")

    expect(commandHandler).toBeDefined()
    expect(ctrlHandler).toBeUndefined()
  })

  it("registers command shortcut as Ctrl on non-Mac", () => {
    ;(Utils.isFromMac as Mock).mockReturnValue(false)
    const shortcut = "cmd+n"
    const onActivate = vi.fn()

    render(
      <TestComponent
        shortcut={shortcut}
        disabled={false}
        onActivate={onActivate}
      />
    )

    const commandHandler = hotkeysWithHandlers.__handlers.get("command+n")
    const ctrlHandler = hotkeysWithHandlers.__handlers.get("ctrl+n")

    expect(commandHandler).toBeUndefined()
    expect(ctrlHandler).toBeDefined()
  })
})

describe("formatShortcutForDisplay", () => {
  it("renders Option for alt modifiers on macOS", () => {
    expect(formatShortcutForDisplay("Alt+S", { isMac: true })).toBe("⌥ + S")
  })

  it("renders correct modifier for mod on macOS", () => {
    expect(formatShortcutForDisplay("Mod+S", { isMac: true })).toBe("⌘ + S")
  })

  it("renders correct modifier for mod on non-mac platforms", () => {
    expect(formatShortcutForDisplay("Mod+S", { isMac: false })).toBe(
      "Ctrl + S"
    )
  })

  it("renders Alt modifiers on non-mac platforms", () => {
    expect(formatShortcutForDisplay("Alt+S", { isMac: false })).toBe("Alt + S")
  })

  it("ignores casing and extra whitespace", () => {
    expect(formatShortcutForDisplay("  cTrL  +   alt +   n  ")).toBe(
      "Ctrl + Alt + N"
    )
  })
})
