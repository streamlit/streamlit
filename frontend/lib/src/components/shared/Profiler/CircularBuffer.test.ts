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

import { describe, expect, it } from "vitest"

import { CircularBuffer } from "./CircularBuffer"

describe("CircularBuffer", () => {
  it("should initialize with the correct size", () => {
    const buffer = new CircularBuffer<number>(3)
    expect(buffer.buffer.length).toBe(3)
  })

  it("should add elements to the buffer", () => {
    const buffer = new CircularBuffer<number>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    expect(buffer.buffer).toEqual([1, 2, 3])
  })

  it("should overwrite elements when the buffer is full", () => {
    const buffer = new CircularBuffer<number>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    buffer.push(4)
    expect(buffer.buffer).toEqual([4, 2, 3])
  })

  it("should correctly count total written entries", () => {
    const buffer = new CircularBuffer<number>(3)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    buffer.push(4)
    buffer.push(5)
    expect(buffer.totalWrittenEntries).toBe(5)
  })

  it("should handle different data types", () => {
    const buffer = new CircularBuffer<string>(2)
    buffer.push("a")
    buffer.push("b")
    buffer.push("c")
    expect(buffer.buffer).toEqual(["c", "b"])
  })
})
