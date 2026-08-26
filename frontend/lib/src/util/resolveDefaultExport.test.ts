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

import { describe, expect, it } from "vitest"

import { resolveDefaultExport } from "./resolveDefaultExport"

describe("resolveDefaultExport", () => {
  const MockComponent = (): null => null

  describe("module shapes from CommonJS interop", () => {
    it("returns the component directly when module has no default wrapper", () => {
      // Case: ESM module or already unwrapped
      const result = resolveDefaultExport(MockComponent)
      expect(result).toBe(MockComponent)
    })

    it("unwraps single default export: { default: Component }", () => {
      // Case: Standard CommonJS interop
      const moduleWithDefault = { default: MockComponent }
      const result = resolveDefaultExport(moduleWithDefault)
      expect(result).toBe(MockComponent)
    })

    it("unwraps double nested default: { default: { default: Component } }", () => {
      // Case: Vite 8 double-wrapped CommonJS interop
      const doubleNested = { default: { default: MockComponent } }
      const result = resolveDefaultExport(doubleNested)
      expect(result).toBe(MockComponent)
    })

    it("unwraps triple nested default: { default: { default: { default: Component } } }", () => {
      // Case: Deeply nested (up to maxDepth)
      const tripleNested = { default: { default: { default: MockComponent } } }
      const result = resolveDefaultExport(tripleNested)
      expect(result).toBe(MockComponent)
    })
  })

  describe("depth limiting", () => {
    it("respects maxDepth and stops unwrapping", () => {
      const tripleNested = { default: { default: { default: MockComponent } } }
      // With maxDepth=2, should stop at { default: MockComponent }
      const result = resolveDefaultExport(tripleNested, 2)
      expect(result).toEqual({ default: MockComponent })
    })

    it("uses default maxDepth of 3", () => {
      // 4 levels of nesting - should stop at the 4th wrapper
      const deeplyNested = {
        default: { default: { default: { default: MockComponent } } },
      }
      const result = resolveDefaultExport(deeplyNested)
      expect(result).toEqual({ default: MockComponent })
    })

    it("handles maxDepth of 1", () => {
      const doubleNested = { default: { default: MockComponent } }
      const result = resolveDefaultExport(doubleNested, 1)
      expect(result).toEqual({ default: MockComponent })
    })
  })

  describe("edge cases", () => {
    it("returns null as-is", () => {
      const result = resolveDefaultExport(null)
      expect(result).toBeNull()
    })

    it("returns undefined as-is", () => {
      const result = resolveDefaultExport(undefined)
      expect(result).toBeUndefined()
    })

    it("returns primitives as-is", () => {
      expect(resolveDefaultExport("string")).toBe("string")
      expect(resolveDefaultExport(42)).toBe(42)
      expect(resolveDefaultExport(true)).toBe(true)
    })

    it("returns arrays as-is (no default property)", () => {
      const arr = [1, 2, 3]
      const result = resolveDefaultExport(arr)
      expect(result).toBe(arr)
    })

    it("returns objects without default property as-is", () => {
      const obj = { foo: "bar", baz: 123 }
      const result = resolveDefaultExport(obj)
      expect(result).toBe(obj)
    })

    it("handles object with default set to null", () => {
      const obj = { default: null }
      const result = resolveDefaultExport(obj)
      // After unwrapping, we get null, which stops further iteration
      expect(result).toBeNull()
    })

    it("handles object with default set to undefined", () => {
      const obj = { default: undefined }
      const result = resolveDefaultExport(obj)
      expect(result).toBeUndefined()
    })
  })
})
