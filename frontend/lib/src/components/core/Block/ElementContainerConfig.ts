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

import { CSSProperties } from "react"

import { MinFlexElementWidth } from "~lib/components/core/Layout/utils"

/**
 * Defines the minimum width behavior for elements in flex layouts.
 *
 * When an element has stretch width and is placed in a horizontal container,
 * this value determines:
 * 1. The minimum width the element can shrink to
 * 2. The flex-basis for distributing space among sibling elements
 *
 * @example
 * - LARGE (14rem): Charts, dataframes, file uploaders - elements that need more space
 * - MEDIUM (8rem): Input widgets - functional at smaller sizes but need some minimum
 * - FIT_CONTENT: Buttons, links - should shrink to their content size
 * - NONE: No minimum width constraint
 */
export enum MinStretchWidth {
  /**
   * Large minimum width (14rem / 224px).
   * Use for: charts, dataframes, code blocks, file uploaders, media elements
   */
  LARGE = "14rem",

  /**
   * Medium minimum width (8rem / 128px).
   * Use for: input widgets, selectors, sliders, progress bars
   */
  MEDIUM = "8rem",

  /**
   * Shrink to content size (fit-content).
   * Use for: buttons, links, feedback
   */
  FIT_CONTENT = "fit-content",

  /**
   * No minimum width constraint.
   * Use for: elements that handle their own sizing or have no minimum requirement
   */
  NONE = "none",
}

interface ElementContainerConfigOptions {
  /**
   * Minimum width behavior for stretch elements in horizontal layouts.
   * @default MinStretchWidth.NONE
   */
  minStretchWidth?: MinStretchWidth

  /**
   * CSS style overrides applied to the element container.
   * These override the computed layout styles.
   */
  styleOverrides?: CSSProperties
}

/**
 * Configuration class for element container styling.
 *
 * Instantiated in each case block of RawElementNodeRenderer to define
 * element-specific layout behavior.
 *
 * @example
 * ```typescript
 * // Simple usage with enum
 * new ElementContainerConfig({ minStretchWidth: MinStretchWidth.LARGE })
 *
 * // With style overrides
 * new ElementContainerConfig({
 *   minStretchWidth: MinStretchWidth.MEDIUM,
 *   styleOverrides: { height: "auto", flex: "" },
 * })
 *
 * // Using pre-defined configs
 * ElementContainerConfig.LARGE_ELEMENT
 * ElementContainerConfig.LARGE_OVERFLOW_VISIBLE
 * ```
 */
export class ElementContainerConfig {
  readonly minStretchWidth: MinStretchWidth
  readonly styleOverrides?: CSSProperties

  // Pre-defined configurations for common patterns.
  // Use these static constants where possible for referential stability.
  static readonly DEFAULT = new ElementContainerConfig({})

  static readonly LARGE_ELEMENT = new ElementContainerConfig({
    minStretchWidth: MinStretchWidth.LARGE,
  })

  static readonly MEDIUM_ELEMENT = new ElementContainerConfig({
    minStretchWidth: MinStretchWidth.MEDIUM,
  })

  static readonly FIT_CONTENT_ELEMENT = new ElementContainerConfig({
    minStretchWidth: MinStretchWidth.FIT_CONTENT,
  })

  static readonly FULL_WIDTH = new ElementContainerConfig({
    styleOverrides: { width: "100%" },
  })

  static readonly LARGE_OVERFLOW_VISIBLE = new ElementContainerConfig({
    minStretchWidth: MinStretchWidth.LARGE,
    styleOverrides: { overflow: "visible" },
  })

  constructor(options: ElementContainerConfigOptions = {}) {
    this.minStretchWidth = options.minStretchWidth ?? MinStretchWidth.NONE
    this.styleOverrides = options.styleOverrides
  }

  /**
   * Creates a new config by merging this config with overrides.
   * Useful for extending pre-defined configs with element-specific adjustments.
   *
   * @example
   * ```typescript
   * ElementContainerConfig.LARGE_ELEMENT.with({ styleOverrides: { overflow: "visible" } })
   * ```
   */
  with(
    overrides: Partial<ElementContainerConfigOptions>
  ): ElementContainerConfig {
    return new ElementContainerConfig({
      minStretchWidth: overrides.minStretchWidth ?? this.minStretchWidth,
      styleOverrides:
        overrides.styleOverrides !== undefined
          ? { ...this.styleOverrides, ...overrides.styleOverrides }
          : this.styleOverrides,
    })
  }

  /**
   * Returns the style overrides to be applied to the element container.
   */
  computeStyleOverrides(): CSSProperties {
    return this.styleOverrides ?? {}
  }

  /**
   * Returns the minStretchBehavior value for useLayoutStyles.
   * Returns undefined for NONE to maintain backward compatibility.
   */
  getMinStretchBehavior(): MinFlexElementWidth {
    return this.minStretchWidth === MinStretchWidth.NONE
      ? undefined
      : this.minStretchWidth
  }
}
