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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BlobUrlManager } from "./blobUrl"

describe("BlobUrlManager", () => {
  let manager: BlobUrlManager

  beforeEach(() => {
    manager = new BlobUrlManager()
    let counter = 0
    // Why mock global URL.createObjectURL?
    // - jsdom in Vitest does not provide a full Blob URL implementation.
    // - In Node test environments, URL.createObjectURL can be undefined or behave
    //   differently than in browsers, which would yield undefined URLs and make
    //   our assertions flaky or impossible.
    // - We stub it to produce deterministic blob: URLs so tests are stable and
    //   focus on our caching logic rather than environment quirks.
    vi.stubGlobal("URL", {
      ...(globalThis.URL as unknown as object),
      createObjectURL: vi.fn(() => `blob:mock-${counter++}`),
    } as unknown as typeof URL)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("computes a stable hash for the same content", () => {
    const a1 = manager.getOrCreateUrlForJs("console.log('a')", "test").hash
    const a2 = manager.getOrCreateUrlForJs("console.log('a')", "test").hash
    expect(a1).toBe(a2)
  })

  it("produces a different hash for different content", () => {
    const a = manager.getOrCreateUrlForJs("console.log('a')", "test").hash
    const b = manager.getOrCreateUrlForJs("console.log('b')", "test").hash
    expect(a).not.toBe(b)
  })

  it("caches and reuses blob URLs for identical content", () => {
    const first = manager.getOrCreateUrlForJs(
      "export default () => {}",
      "test"
    )
    const second = manager.getOrCreateUrlForJs(
      "export default () => {}",
      "test"
    )
    expect(first.hash).toBe(second.hash)
    expect(first.url).toBe(second.url)
  })

  it("creates different blob URLs for different content", () => {
    const first = manager.getOrCreateUrlForJs("export default 1", "test")
    const second = manager.getOrCreateUrlForJs("export default 2", "test")
    expect(first.hash).not.toBe(second.hash)
    expect(typeof first.url).toBe("string")
    expect(typeof second.url).toBe("string")
    expect(first.url).not.toBe(second.url)
  })
})
