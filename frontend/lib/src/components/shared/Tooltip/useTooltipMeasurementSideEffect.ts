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

import { useEffect } from "react"

import { useWindowDimensionsContext } from "@streamlit/lib"

/**
 * A hook that handles tooltip positioning and measurement with retry logic to
 * ensure proper positioning even when initial measurements are invalid.
 *
 * This is a side effect of the Tooltip component, so it's not a hook that
 * should be used in any other place. This hook exists due to the race
 * conditions in the BaseWeb Tooltip and the need to ensure that the tooltip is
 * always positioned correctly.
 *
 * When we move off of BaseWeb we should delete this hook!
 *
 * @param tooltipElement The tooltip element ref
 * @param isOpen Whether the tooltip is currently open
 *
 * @deprecated This is not a pattern we should use. Only here so until we move
 * off of BaseWeb.
 */
export function useTooltipMeasurementSideEffect(
  tooltipElement: HTMLDivElement | null,
  isOpen: boolean
): void {
  const { innerWidth } = useWindowDimensionsContext()

  useEffect(() => {
    const parentElement = tooltipElement?.parentElement
    if (!parentElement) {
      return
    }

    const handleMeasurement = async (): Promise<void> => {
      // Implement a retry mechanism to ensure we get valid coordinates
      const getMeasurements = (): DOMRect | null => {
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
        const rect = parentElement.getBoundingClientRect()
        // Check if we have valid non-zero coordinates
        if (rect.x !== 0 || rect.y !== 0) {
          return rect
        }
        return null
      }

      // Try to get valid measurements with retries
      let boundingClientRect: DOMRect | null = null
      let attempts = 0
      const maxAttempts = 5

      while (!boundingClientRect && attempts < maxAttempts) {
        boundingClientRect = getMeasurements()
        if (!boundingClientRect) {
          attempts++
          // Wait for next frame before trying again
          await new Promise(resolve => requestAnimationFrame(resolve))
        }
      }

      // If we still don't have valid measurements after all attempts, use what we have
      if (!boundingClientRect) {
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
        boundingClientRect = parentElement.getBoundingClientRect()
      }

      const xCoordinate = boundingClientRect.x

      const overflowRight = xCoordinate + boundingClientRect.width - innerWidth

      // this is the out-of-tree Basweb DOM structure. For the right overflow,
      // this is the element that has the transform-style property set that needs
      // to be modified.
      const parentsParentElement = parentElement.parentElement

      if (overflowRight > 0 && parentsParentElement) {
        // Baseweb uses a transform to position the tooltip, so we need to adjust the transform instead
        // of the left / right property, otherwise it looks weird when the tooltip overflows the right side
        const transformStyleMatrix = new DOMMatrix(
          // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
          window.getComputedStyle(parentsParentElement)?.transform
        )
        parentsParentElement.style.transform = `translate3d(${
          transformStyleMatrix.e - overflowRight
        }px, ${transformStyleMatrix.f}px, 0px)`
      }

      if (xCoordinate < 0) {
        parentElement.style.left = `${-xCoordinate}px`
      }
    }

    void handleMeasurement()
  }, [tooltipElement, isOpen, innerWidth])
}
