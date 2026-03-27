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

/**
 * Runtime guard patch for DeckGL/Luma canvas resizing under Vite 8.
 *
 * Intent:
 * - Prevent hard runtime crashes in DeckGL charts when Luma's
 *   `CanvasContext.getMaxDrawingBufferSize()` is called before `device.limits`
 *   is fully available.
 *
 * Why this exists:
 * - In our Vite 8 dev path, we observed intermittent
 *   `maxTextureDimension2D` access errors during resize/observer callbacks.
 * - This patch preserves rendering by falling back to current canvas
 *   dimensions until the device limits are ready.
 *
 * Removal criteria:
 * - Remove once upstream dependency behavior is stable and this error no
 *   longer occurs in local debug sessions:
 *   `TypeError: Cannot read properties of undefined (reading 'maxTextureDimension2D')`
 * - Validate by running the debug app and checking
 *   `work-tmp/debug/latest/frontend.log` for DeckGL/Luma unhandled errors.
 *
 * Vite references:
 * - https://vite.dev/guide/migration.html
 * - https://vite.dev/config/dep-optimization-options
 */
import { CanvasContext } from "@luma.gl/core"

type MaybePatchedCanvasContext = CanvasContext & {
  __streamlitMaxTexturePatchApplied?: boolean
  canvas?: { width?: number; height?: number }
  device?: {
    limits?: {
      maxTextureDimension2D?: number
    }
  }
}

const canvasContextProto = CanvasContext.prototype as MaybePatchedCanvasContext

if (!canvasContextProto.__streamlitMaxTexturePatchApplied) {
  const originalGetMaxDrawingBufferSize =
    canvasContextProto.getMaxDrawingBufferSize

  canvasContextProto.getMaxDrawingBufferSize =
    function patchedGetMaxDrawingBufferSize(): [number, number] {
      const maxTextureDimension = this.device?.limits?.maxTextureDimension2D
      if (!maxTextureDimension) {
        return [this.canvas?.width ?? 1, this.canvas?.height ?? 1]
      }
      return originalGetMaxDrawingBufferSize.call(this)
    }

  canvasContextProto.__streamlitMaxTexturePatchApplied = true
}
