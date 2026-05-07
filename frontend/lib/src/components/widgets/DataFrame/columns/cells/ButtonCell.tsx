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
  GridCellKind,
  roundedRect,
} from "@glideapps/glide-data-grid"
import { darken } from "color2k"

import {
  isMaterialIcon,
  parseIconPackEntry,
} from "~lib/components/shared/Icon/DynamicIcon"
import { genericFonts } from "~lib/theme/primitives/typography"

export type ButtonCellData = string | string[] | null

/** Internal button padding (horizontal). */
const BUTTON_PADDING = 8

/** Gap between icon and text in button labels. */
const ICON_TEXT_GAP = 4

/** Tolerance margin for click detection to account for estimation errors. */
const CLICK_TOLERANCE = 8

/** Bounds rectangle for menu positioning. */
interface MenuBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Click X position (screen coordinates). */
  readonly clickX: number
  /** Click Y position (screen coordinates). */
  readonly clickY: number
}

interface ButtonCellProps {
  readonly kind: "button-cell"
  /** The button label(s). String for single button, array for dropdown menu. */
  readonly data: ButtonCellData
  /** The button style variant. */
  readonly buttonType: "primary" | "secondary" | "tertiary"
  /** Horizontal alignment of the button in the cell. Defaults to center. */
  readonly alignment?: "left" | "center" | "right"
  /** The row index (original data row, before sorting). Set by DataFrame when rendering. */
  readonly rowIndex?: number
  /** Callback when a single button is clicked (set by DataFrame component). */
  readonly onClick?: (rowIndex: number, label: string) => void
  /** Callback to open menu for multi-action buttons (set by DataFrame component). */
  readonly onOpenMenu?: (
    rowIndex: number,
    actions: string[],
    bounds: MenuBounds
  ) => void
}

export type ButtonCell = CustomCell<ButtonCellProps>

interface ParsedLabel {
  icon: string | null
  text: string
}

/**
 * Parse a button label to extract leading Material icon.
 * Supports `:material/icon_name:` syntax.
 */
function parseButtonLabel(label: string): ParsedLabel {
  const iconMatch = label.match(/^:material\/([^:]+):(.*)$/)

  if (iconMatch && isMaterialIcon(`:material/${iconMatch[1]}:`)) {
    return {
      icon: parseIconPackEntry(`:material/${iconMatch[1]}:`).icon,
      text: iconMatch[2].trim(),
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
  theme: { baseFontStyle: string; baseFontFull: string }
): number {
  const iconFont = `${theme.baseFontStyle} '${genericFonts.iconFont}'`

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
    if (text) width += ICON_TEXT_GAP
  }
  if (text) {
    ctx.font = theme.baseFontFull
    width += ctx.measureText(text).width
  }

  return width
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
  const buttonWidth = contentWidth + BUTTON_PADDING * 2
  const verticalPadding = Math.floor(cellPadding * 0.5)
  const buttonHeight = Math.ceil(cellHeight - verticalPadding * 2)

  let buttonX: number
  switch (alignment) {
    case "left":
      buttonX = cellPadding
      break
    case "right":
      buttonX = cellWidth - buttonWidth - cellPadding
      break
    case "center":
    default:
      buttonX = (cellWidth - buttonWidth) / 2
      break
  }

  return {
    x: buttonX,
    y: verticalPadding,
    width: buttonWidth,
    height: buttonHeight,
  }
}

/**
 * Check if position is within button bounds.
 * Optionally adds tolerance margin to account for estimation errors in click detection.
 */
function isWithinButton(
  bounds: ButtonBounds,
  posX: number | undefined,
  posY: number | undefined,
  tolerance = 0
): boolean {
  if (posX === undefined || posY === undefined) return false

  return (
    posX >= bounds.x - tolerance &&
    posX <= bounds.x + bounds.width + tolerance &&
    posY >= bounds.y - tolerance &&
    posY <= bounds.y + bounds.height + tolerance
  )
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
  isMatch: (c): c is ButtonCell =>
    (c.data as Record<string, unknown>).kind === "button-cell",
  needsHover: true,
  needsHoverPosition: true,
  onSelect: a => a.preventDefault(),
  onClick: args => {
    const { cell, bounds, posX, posY, theme } = args
    const { data, onClick, onOpenMenu, rowIndex, alignment } = cell.data
    if (!data || rowIndex === undefined) return undefined

    // Estimate content width without ctx (conservative char width estimate)
    const label = getSingleButtonLabel(data)
    const isMultiAction = Array.isArray(data) && data.length > 1
    let estimatedContentWidth: number

    if (isMultiAction) {
      // Multi-action buttons show the "more_vert" icon (~20px)
      estimatedContentWidth = 20
    } else {
      const hasIcon = label?.startsWith(":material/") ?? false
      const textPart = hasIcon
        ? label?.replace(/^:material\/[^:]+:/, "").trim()
        : label
      // Use ~7px per character as a rough estimate. This won't match the actual
      // rendered width exactly, but CLICK_TOLERANCE compensates for the mismatch.
      estimatedContentWidth = (textPart?.length ?? 0) * 7 + (hasIcon ? 20 : 0)
    }

    const buttonBounds = getButtonBounds(
      bounds.width,
      bounds.height,
      theme.cellHorizontalPadding,
      estimatedContentWidth,
      alignment
    )

    // Use tolerance margin to account for estimation mismatch with precise draw bounds
    if (!isWithinButton(buttonBounds, posX, posY, CLICK_TOLERANCE)) {
      return undefined
    }

    if (label) {
      onClick?.(rowIndex, label)
    } else if (isMultiAction) {
      // Multi-action: open menu at the click position.
      // The bounds Rectangle from glide-data-grid is in viewport/screen coordinates,
      // which matches the fixed positioning used by the ButtonActionMenu anchor.
      const clickX = bounds.x + (posX ?? bounds.width / 2)
      const clickY = bounds.y + (posY ?? bounds.height / 2)
      onOpenMenu?.(rowIndex, data, { ...bounds, clickX, clickY })
    }

    return undefined
  },
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

    if (!data) return true

    const label = getSingleButtonLabel(data)
    const isMultiAction = Array.isArray(data) && data.length > 1

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
        const totalWidth = iconWidth + ICON_TEXT_GAP + textWidth
        const startX = centerX - totalWidth / 2

        ctx.fillText(icon, startX + iconWidth / 2, centerY + middleCenterBias)

        ctx.font = theme.baseFontFull
        ctx.fillText(
          text,
          startX + iconWidth + ICON_TEXT_GAP + textWidth / 2,
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
    if (!data) return theme.cellHorizontalPadding * 2

    // For multi-action buttons, use placeholder width
    const label = getSingleButtonLabel(data) ?? "..."

    const { icon, text } = parseButtonLabel(label)
    const iconFont = `${theme.baseFontStyle} '${genericFonts.iconFont}'`

    let width = 0
    if (icon) {
      ctx.font = iconFont
      width += ctx.measureText(icon).width
      if (text) width += ICON_TEXT_GAP
    }
    if (text) {
      ctx.font = theme.baseFontFull
      width += ctx.measureText(text).width
    }

    return width + theme.cellHorizontalPadding * 2 + BUTTON_PADDING * 2
  },
  provideEditor: undefined,
}

export default renderer
