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

import { CanvasContext } from "@luma.gl/core"

// Side-effect import: patches CanvasContext.prototype.getMaxDrawingBufferSize.
import "./patchLumaCanvasContext"

type PatchedCanvasContext = CanvasContext & {
  canvas?: { width?: number; height?: number }
  device?: { limits?: { maxTextureDimension2D?: number } }
}

function createPatchedContext(
  overrides: {
    canvas?: { width?: number; height?: number }
    device?: { limits?: { maxTextureDimension2D?: number } }
  } = {}
): PatchedCanvasContext {
  return Object.assign(
    Object.create(CanvasContext.prototype),
    overrides
  ) as PatchedCanvasContext
}

describe("patchLumaCanvasContext", () => {
  it("falls back to canvas size when device limits are missing", () => {
    const ctx = createPatchedContext({
      canvas: { width: 12, height: 34 },
      device: {},
    })

    expect(ctx.getMaxDrawingBufferSize()).toEqual([12, 34])
  })

  it("falls back to 1x1 when canvas size is also missing", () => {
    const ctx = createPatchedContext({ device: { limits: {} } })

    expect(ctx.getMaxDrawingBufferSize()).toEqual([1, 1])
  })
})
