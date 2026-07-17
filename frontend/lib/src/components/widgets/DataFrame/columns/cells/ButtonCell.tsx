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

import {
  type CustomCell,
  type CustomRenderer,
  getMiddleCenterBias,
  type Theme as GlideTheme,
  type GridCell,
  GridCellKind,
  type Rectangle,
  roundedRect,
} from "@glideapps/glide-data-grid"
import { darken } from "color2k"

import {
  extractLeadingMaterialIcon,
  isMaterialIcon,
  parseIconPackEntry,
} from "~lib/components/shared/Icon/DynamicIcon"
import { genericFonts } from "~lib/theme/primitives/typography"

export type ButtonCellData = string | string[] | null

export type ButtonInteractionTheme = Pick<
  GlideTheme,
  "baseFontStyle" | "cellHorizontalPadding" | "fontFamily"
>

export type ButtonMenuBounds = Rectangle & {
  /** Click X position (screen coordinates). */
  readonly clickX: number
  /** Click Y position (screen coordinates). */
  readonly clickY: number
}

type ButtonCellClickTarget =
  | {
      readonly kind: "button"
      readonly label: string
    }
  | {
      readonly kind: "menu"
      readonly actions: string[]
      readonly bounds: ButtonMenuBounds
    }

/** Fallback width for the "more_vert" menu icon when canvas is unavailable. */
const MULTI_ACTION_ICON_WIDTH = 20

/** Fallback width per character when canvas is unavailable. */
const CHAR_WIDTH_ESTIMATE = 7

/** Fallback width for a Material icon when canvas is unavailable. */
const ICON_WIDTH_ESTIMATE = 20

/** Minimum gap between icon and text in button labels. */
const MIN_ICON_TEXT_GAP = 4

interface ButtonCellProps {
  readonly kind: "button-cell"
  /** The button label(s). String for single button, array for dropdown menu. */
  readonly data: ButtonCellData
  /** The button style variant. */
  readonly buttonType: "primary" | "secondary" | "tertiary"
  /** Horizontal alignment of the button in the cell. Defaults to center. */
  readonly alignment?: "left" | "center" | "right"
}

export type ButtonCell = CustomCell<ButtonCellProps>

interface ParsedLabel {
  icon: string | null
  text: string
}

function getIconTextGap(cellHorizontalPadding: number): number {
  return Math.max(MIN_ICON_TEXT_GAP, cellHorizontalPadding / 2)
}

function getBaseFontFull(theme: ButtonInteractionTheme): string {
  return `${theme.baseFontStyle} ${theme.fontFamily}`
}

/**
 * Parse a button label to extract leading Material icon.
 * Supports `:material/icon_name:` syntax.
 *
 * Icon extraction is delegated to the shared `extractLeadingMaterialIcon`
 * helper so the canvas-drawn button and the `ButtonActionMenu` dropdown stay
 * consistent. The extracted icon token is then resolved to the icon glyph name
 * used for canvas rendering.
 */
function parseButtonLabel(label: string): ParsedLabel {
  const { icon: iconToken, text } = extractLeadingMaterialIcon(label)

  if (iconToken && isMaterialIcon(iconToken)) {
    return {
      icon: parseIconPackEntry(iconToken).icon,
      text: text.trim(),
    }
  }

  return { icon: null, text: label }
}

/**
 * Calculate the content width of a button label (text + icon).
 * For multi-action buttons (label is null), measures the "more_vert" icon.
 */
function getContentWidth(
  ctx: CanvasRenderingContext2D,
  label: string | null,
  theme: ButtonInteractionTheme
): number {
  const iconFont = `${theme.baseFontStyle} '${genericFonts.iconFont}'`
  const iconTextGap = getIconTextGap(theme.cellHorizontalPadding)

  if (!label) {
    // Multi-action button uses "more_vert" icon
    ctx.font = iconFont
    return ctx.measureText("more_vert").width
  }

  const { icon, text } = parseButtonLabel(label)

  let width = 0
  if (icon) {
    ctx.font = iconFont
    width += ctx.measureText(icon).width
    if (text) width += iconTextGap
  }
  if (text) {
    ctx.font = getBaseFontFull(theme)
    width += ctx.measureText(text).width
  }

  return width
}

let cachedMeasurementContext: CanvasRenderingContext2D | null | undefined

function getMeasurementContext(
  measureContext?: CanvasRenderingContext2D
): CanvasRenderingContext2D | undefined {
  if (measureContext !== undefined) {
    return measureContext
  }

  if (cachedMeasurementContext === undefined) {
    cachedMeasurementContext =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d")
  }

  return cachedMeasurementContext ?? undefined
}

function getEstimatedContentWidth(
  label: string | null,
  isMultiAction: boolean,
  theme: ButtonInteractionTheme
): number {
  if (isMultiAction) {
    return MULTI_ACTION_ICON_WIDTH
  }

  if (!label) {
    return 0
  }

  const { icon, text } = parseButtonLabel(label)

  return (
    text.length * CHAR_WIDTH_ESTIMATE +
    (icon ? ICON_WIDTH_ESTIMATE : 0) +
    (icon && text ? getIconTextGap(theme.cellHorizontalPadding) : 0)
  )
}

function getClickContentWidth(
  label: string | null,
  isMultiAction: boolean,
  theme: ButtonInteractionTheme,
  measureContext?: CanvasRenderingContext2D
): number {
  const ctx = getMeasurementContext(measureContext)
  if (ctx) {
    return getContentWidth(ctx, label, theme)
  }

  return getEstimatedContentWidth(label, isMultiAction, theme)
}

/**
 * Get the label for a single button from cell data.
 * Returns null for multi-action buttons (array with 2+ items) or empty data.
 */
function getSingleButtonLabel(data: ButtonCellData): string | null {
  if (typeof data === "string") return data
  if (Array.isArray(data) && data.length === 1) return data[0]
  return null
}

interface ButtonBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Alignment-based button X position calculation */
const ALIGNMENT_OFFSET: Record<
  "left" | "center" | "right",
  (cellWidth: number, cellPadding: number, buttonWidth: number) => number
> = {
  left: (_cellWidth, cellPadding) => cellPadding,
  center: (cellWidth, _cellPadding, buttonWidth) =>
    (cellWidth - buttonWidth) / 2,
  right: (cellWidth, cellPadding, buttonWidth) =>
    cellWidth - buttonWidth - cellPadding,
}

/**
 * Calculate button bounds relative to cell origin.
 * Used by both draw (for hover) and onClick (for click detection).
 */
function getButtonBounds(
  cellWidth: number,
  cellHeight: number,
  cellPadding: number,
  contentWidth: number,
  alignment: "left" | "center" | "right" = "center"
): ButtonBounds {
  const buttonWidth = contentWidth + cellPadding * 2
  const verticalPadding = Math.floor(cellPadding * 0.5)
  const buttonHeight = Math.ceil(cellHeight - verticalPadding * 2)

  return {
    x: ALIGNMENT_OFFSET[alignment](cellWidth, cellPadding, buttonWidth),
    y: verticalPadding,
    width: buttonWidth,
    height: buttonHeight,
  }
}

/**
 * Check if position is within button bounds.
 */
function isWithinButton(
  bounds: ButtonBounds,
  posX: number | undefined,
  posY: number | undefined
): boolean {
  if (posX === undefined || posY === undefined) return false

  return (
    posX >= bounds.x &&
    posX <= bounds.x + bounds.width &&
    posY >= bounds.y &&
    posY <= bounds.y + bounds.height
  )
}

export function isButtonCell(cell: GridCell): cell is ButtonCell {
  return (
    cell.kind === GridCellKind.Custom &&
    (cell.data as Record<string, unknown>)?.kind === "button-cell"
  )
}

export function getButtonCellClickTarget(
  cell: ButtonCell,
  {
    bounds,
    posX,
    posY,
    theme,
    measureContext,
  }: {
    bounds: Rectangle
    posX: number | undefined
    posY: number | undefined
    theme: ButtonInteractionTheme
    measureContext?: CanvasRenderingContext2D
  }
): ButtonCellClickTarget | undefined {
  const { data, alignment } = cell.data
  if (!data) return undefined

  const label = getSingleButtonLabel(data)
  const isMultiAction = Array.isArray(data) && data.length > 1

  // No interactive button is rendered when there is no content to show
  // (e.g. an empty-string label), so clicks are ignored to match draw().
  if (!isMultiAction && !label) return undefined

  const contentWidth = getClickContentWidth(
    label,
    isMultiAction,
    theme,
    measureContext
  )

  const buttonBounds = getButtonBounds(
    bounds.width,
    bounds.height,
    theme.cellHorizontalPadding,
    contentWidth,
    alignment
  )

  if (!isWithinButton(buttonBounds, posX, posY)) {
    return undefined
  }

  if (label) {
    return {
      kind: "button",
      label,
    }
  }

  if (isMultiAction) {
    return {
      kind: "menu",
      actions: data,
      bounds: {
        ...bounds,
        clickX: bounds.x + (posX ?? bounds.width / 2),
        clickY: bounds.y + (posY ?? bounds.height / 2),
      },
    }
  }

  return undefined
}

/**
 * Custom cell renderer for button columns.
 *
 * Renders clickable buttons in dataframe cells:
 * - Single string: Renders a button with the string as label
 * - Array with 1 item: Renders a single button
 * - Array with 2+ items: Renders a three-dot menu icon that opens a dropdown
 * - null/undefined: Empty cell
 *
 * Button labels can include leading Material icons using `:material/icon_name:` syntax.
 */
const renderer: CustomRenderer<ButtonCell> = {
  kind: GridCellKind.Custom,
  isMatch: isButtonCell,
  needsHover: true,
  needsHoverPosition: true,
  onSelect: a => a.preventDefault(),
  drawPrep: args => {
    const { ctx } = args
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    return {
      deprep: a => {
        a.ctx.textAlign = "start"
        a.ctx.textBaseline = "alphabetic"
      },
    }
  },
  draw: (args, cell) => {
    const { ctx, theme, rect, hoverX, hoverY } = args
    const { data, buttonType, alignment } = cell.data
    const padding = theme.cellHorizontalPadding

    const label = getSingleButtonLabel(data)
    const isMultiAction = Array.isArray(data) && data.length > 1

    // Skip rendering when there is no content to show: null/undefined data, an
    // empty array, or a single empty-string label. Multi-action buttons render
    // the "more_vert" icon even though their single-label value is null.
    if (!isMultiAction && !label) return true

    // Calculate button bounds using shared helper
    const contentWidth = getContentWidth(ctx, label, theme)
    const buttonBounds = getButtonBounds(
      rect.width,
      rect.height,
      padding,
      contentWidth,
      alignment
    )

    // Absolute position for drawing
    const buttonX = Math.floor(rect.x + buttonBounds.x)
    const buttonY = Math.floor(rect.y + buttonBounds.y)
    const buttonWidth = buttonBounds.width
    const buttonHeight = buttonBounds.height

    if (buttonWidth <= 0 || buttonHeight <= 0) return true

    const isHovered = isWithinButton(buttonBounds, hoverX, hoverY)
    if (isHovered) {
      args.overrideCursor?.("pointer")
    }

    // Get colors based on button type
    let bgColor: string | undefined
    let borderColor: string | undefined
    let textColor: string

    const primaryBg = theme.accentColor
    const primaryBgHover = darken(theme.accentColor, 0.15)

    switch (buttonType) {
      case "primary":
        bgColor = isHovered ? primaryBgHover : primaryBg
        borderColor = undefined
        // White text provides good contrast with most primary colors including the
        // default red (#ff4b4b). While readableColor() could auto-switch to black
        // for very light themes, it incorrectly returns black for the default red.
        textColor = "#ffffff"
        break
      case "secondary":
        bgColor = isHovered ? theme.bgHeaderHovered : "transparent"
        borderColor = theme.borderColor
        textColor = theme.textDark
        break
      case "tertiary":
      default:
        bgColor = "transparent"
        borderColor = undefined
        textColor = isHovered ? theme.accentColor : theme.textDark
        break
    }

    const borderRadius = theme.roundingRadius ?? 4

    // Draw button background
    if (bgColor && bgColor !== "transparent") {
      ctx.beginPath()
      roundedRect(
        ctx,
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        borderRadius
      )
      ctx.fillStyle = bgColor
      ctx.fill()
    }

    // Draw button border (for secondary style)
    if (borderColor) {
      ctx.beginPath()
      roundedRect(
        ctx,
        buttonX + 0.5,
        buttonY + 0.5,
        buttonWidth - 1,
        buttonHeight - 1,
        borderRadius
      )
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const centerX = buttonX + buttonWidth / 2
    const centerY = rect.y + rect.height / 2
    const middleCenterBias = getMiddleCenterBias(ctx, theme.baseFontFull)
    const iconFont = `${theme.baseFontStyle} '${genericFonts.iconFont}'`
    const iconTextGap = getIconTextGap(theme.cellHorizontalPadding)

    if (isMultiAction) {
      // Draw three-dot menu icon for multi-action
      ctx.font = iconFont
      ctx.fillStyle = textColor
      ctx.fillText("more_vert", centerX, centerY + middleCenterBias)
    } else if (label) {
      // Draw single button label (with optional icon)
      const { icon, text } = parseButtonLabel(label)
      ctx.fillStyle = textColor

      if (icon && text) {
        // Icon + text: draw icon left, text right
        ctx.font = theme.baseFontFull
        const textWidth = ctx.measureText(text).width
        ctx.font = iconFont
        const iconWidth = ctx.measureText(icon).width
        const totalWidth = iconWidth + iconTextGap + textWidth
        const startX = centerX - totalWidth / 2

        ctx.fillText(icon, startX + iconWidth / 2, centerY + middleCenterBias)

        ctx.font = theme.baseFontFull
        ctx.fillText(
          text,
          startX + iconWidth + iconTextGap + textWidth / 2,
          centerY + middleCenterBias
        )
      } else if (icon) {
        ctx.font = iconFont
        ctx.fillText(icon, centerX, centerY + middleCenterBias)
      } else {
        ctx.font = theme.baseFontFull
        ctx.fillText(text, centerX, centerY + middleCenterBias)
      }
    }

    return true
  },
  measure: (ctx, cell, theme) => {
    const { data } = cell.data
    const label = getSingleButtonLabel(data)
    const isMultiAction = Array.isArray(data) && data.length > 1

    // Return minimal width when there is no content to render: null/undefined
    // data, an empty array, or a single empty-string label.
    if (!isMultiAction && !label) {
      return theme.cellHorizontalPadding * 2
    }

    // Reuse the same measurement logic as draw() so column auto-sizing stays in
    // sync. getContentWidth measures the "more_vert" icon for multi-action
    // buttons (label is null) and the icon/text otherwise.
    const contentWidth = getContentWidth(ctx, label, theme)

    // Account for the button's internal horizontal padding on both sides plus
    // the cell's own horizontal padding around the button (matching the bounds
    // computed in getButtonBounds).
    return contentWidth + theme.cellHorizontalPadding * 4
  },
  provideEditor: undefined,
}

export default renderer
