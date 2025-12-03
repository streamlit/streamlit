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

import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"
import "vitest-canvas-mock"

// In the event a sub-library uses the jest global, we need to make sure it's
// aliased to the vi global. An example is timers using dom testing library
// which is used by the react testing library and waitFor.
// (See https://github.com/testing-library/dom-testing-library/issues/987)
global.jest = vi

if (typeof window.URL.createObjectURL === "undefined") {
  window.URL.createObjectURL = vi.fn()
}

const originalConsoleWarn = console.warn
console.warn = (...args) => {
  if (/`LayersManager` was not found./.test(args[0])) {
    // If the warning message matches, don't call the original console.warn
    return
  }
  // For all other warnings, call the original console.warn
  originalConsoleWarn(...args)
}

// Add fake animate method to Elements
Element.prototype.animate = vi
  .fn()
  .mockImplementation(() => ({ addEventListener: vi.fn() }))

// Provide a constructable ResizeObserver mock so `new ResizeObserver(...)`
// works in tests under Vitest v4.
const resizeObserverMock = vi.fn()

class ResizeObserverMock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  public callback: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  public observe: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  public unobserve: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  public disconnect: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  constructor(callback: any) {
    this.callback = callback
    resizeObserverMock(callback)
    this.observe = vi.fn()
    this.unobserve = vi.fn()
    this.disconnect = vi.fn()
  }
}

// Cast through unknown/any to avoid relying on DOM lib types in this setup file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
;(global as any).ResizeObserver = ResizeObserverMock

process.env.TZ = "UTC"
