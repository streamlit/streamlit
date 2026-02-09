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

import "@testing-library/jest-dom/vitest"
import { configure } from "@testing-library/react"
import { vi } from "vitest"
import "vitest-canvas-mock"

// Bump the default timeout for async utilities to 5 seconds (default is 1000ms)
// due to the slower machine speeds in our CI environment.
configure({ asyncUtilTimeout: 5_000 })

// In the event a sub-library uses the jest global, we need to make sure it's
// aliased to the vi global. An example is timers using dom testing library
// which is used by the react testing library and waitFor.
// (See https://github.com/testing-library/dom-testing-library/issues/987)
globalThis.jest = vi

// Initialize the shared mock state for StreamlitConfig.
// This must be done early, before any modules that use StreamlitConfig are loaded.
//
// Usage in test files:
// 1. Add the vi.mock call with a getter (required for dynamic value resolution):
//    vi.mock("@streamlit/utils", async () => {
//      const actual = await vi.importActual("@streamlit/utils")
//      return {
//        ...actual,
//        get StreamlitConfig() {
//          return globalThis.__mockStreamlitConfig
//        },
//      }
//    })
//
// 2. Reset in afterEach:
//    afterEach(() => { globalThis.__mockStreamlitConfig = {} })
//
// 3. Set values in tests:
//    globalThis.__mockStreamlitConfig.BACKEND_BASE_URL = "http://example.com"
globalThis.__mockStreamlitConfig = {}

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
  .mockImplementation(() => ({ addEventListener: vi.fn(), cancel: vi.fn() }))

class ResizeObserverMock {
  public callback: (
    entries: ResizeObserverEntry[],
    observer: ResizeObserver
  ) => void
  public observe: (element: Element) => void = vi.fn()
  public unobserve: (element: Element) => void = vi.fn()
  public disconnect: () => void = vi.fn()

  constructor(
    callback: (
      entries: ResizeObserverEntry[],
      observer: ResizeObserver
    ) => void
  ) {
    this.callback = callback
    vi.fn(callback)
  }
}

globalThis.ResizeObserver = ResizeObserverMock

// Minimal AudioBuffer mock for environments without the Web Audio API (Node).
// This is sufficient for wavesurfer.js and related audio tests that only
// require a constructable AudioBuffer with length/sampleRate metadata.
class AudioBufferMock {
  public length: number
  public sampleRate: number
  public numberOfChannels: number

  constructor(
    optionsOrLength:
      | number
      | {
          length: number
          sampleRate: number
          numberOfChannels?: number
        },
    sampleRate?: number
  ) {
    if (typeof optionsOrLength === "number") {
      this.length = optionsOrLength
      this.sampleRate = sampleRate ?? 44100
      this.numberOfChannels = 1
    } else {
      this.length = optionsOrLength.length
      this.sampleRate = optionsOrLength.sampleRate
      this.numberOfChannels = optionsOrLength.numberOfChannels ?? 1
    }
  }

  // The duration (in seconds) of the buffer.
  public get duration(): number {
    return this.length / this.sampleRate
  }

  public getChannelData(_channel: number): Float32Array {
    return new Float32Array(this.length)
  }

  // Minimal stub for copyFromChannel.
  public copyFromChannel(
    destination: Float32Array,
    _channelNumber: number,
    _startInChannel = 0
  ): void {
    destination.fill(0)
  }

  // Minimal stub for copyToChannel.
  public copyToChannel(
    _source: Float32Array,
    _channelNumber: number,
    _startInChannel = 0
  ): void {
    // No-op for mock
  }
}

;(globalThis as { AudioBuffer: typeof AudioBufferMock }).AudioBuffer =
  AudioBufferMock

process.env.TZ = "UTC"
