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

import styled from "@emotion/styled"

import { getPopoverContainerStyle } from "~lib/components/shared/Base/styled-components"
import { printWidthCapRules } from "~lib/components/shared/printWidthCap"

import {
  DATAFRAME_PRINT_NOTE_CLASS,
  DATAFRAME_PRINT_SCALE_CLASS,
  DATAFRAME_PRINT_SCALE_VAR,
  DATAFRAME_PRINT_SLOT_CLASS,
  DATAFRAME_PRINT_TABLE_CLASS,
  DATAFRAME_PRINT_WIDTH_VAR,
} from "./printClassNames"

/**
 * Unitless ratio of the print column to the table's natural width.
 *
 * An inline `--st-df-print-scale` wins when the browser drops `tan(atan2)`.
 * Otherwise `100cqw` is the slot, so the type tracks the printed column
 * without waiting for a `matchMedia` change. `zoom` is not used: Chromium's
 * PDF recorder inserts gaps inside words when a table is zoomed.
 */
const PRINT_FIT_RATIO = `var(${DATAFRAME_PRINT_SCALE_VAR}, min(1, tan(atan2(100cqw, var(${DATAFRAME_PRINT_WIDTH_VAR}, 100cqw)))))`

interface StyledResizableContainerProps {
  isInHorizontalLayout: boolean
  minHeight: number
  disableResize: boolean
}

/**
 * A resizable data grid container component.
 */
export const StyledResizableContainer =
  styled.div<StyledResizableContainerProps>(
    ({ theme, disableResize, minHeight }) => ({
      position: "relative",
      display: disableResize ? "flex" : "inline-block",
      height: "100%",

      "& .stDataFrameGlideDataEditor": {
        height: "100%",
        minWidth: "100%",
        minHeight: minHeight,
        borderRadius: theme.radii.default,
      },

      "& .stDataFrameResizable": {
        "@media print": {
          // re-resizable writes an inline pixel width measured on screen.
          // Keep that width when no print table was built. Forcing 100%
          // stretches the canvas, and glide does not repaint before the
          // snapshot. Cap it so a wider grid cannot spill the column.
          maxWidth: "100% !important",
        },
      },

      // Filled in beforeprint with an HTML table of the whole dataframe.
      // Hidden on screen so the canvas grid is what the user interacts with.
      [`& .${DATAFRAME_PRINT_SLOT_CLASS}`]: {
        display: "none",
      },

      "@media print": {
        // The grid locks the on-screen pixel width. Cap the container so a
        // narrower page does not spill it. The canvas keeps its fixed or
        // content width when no print table is built.
        ...printWidthCapRules,
        [`&:has(.${DATAFRAME_PRINT_NOTE_CLASS}), &:has(.${DATAFRAME_PRINT_TABLE_CLASS})`]:
          {
            // A note or a print table sits under the canvas, not beside it.
            // The on-screen box is a fixed height and, when resize is
            // disabled, a fixed display too; grow and stack both so the
            // fallback note and the table are not clipped or pushed aside.
            display: "block",
            width: "100%",
            height: "auto",
            maxHeight: "none",
          },
        [`& .${DATAFRAME_PRINT_SLOT_CLASS}`]: {
          display: "block",
          width: "100%",
          // The table's natural width is wider than the page. This slot is
          // the printed column, and the table scales down to it. The slot
          // stays as tall as that table, including a header repeated after
          // a page break, so the bordered container wraps every row.
          containerType: "inline-size",
        },
        [`& .${DATAFRAME_PRINT_SCALE_CLASS}`]: {
          // The wrapper follows the table. Capping both at the column keeps
          // a wide frame inside the card. The font scale below shrinks the
          // text to that width.
          width: `min(100%, var(${DATAFRAME_PRINT_WIDTH_VAR}))`,
          maxWidth: "100%",
        },
        [`& .${DATAFRAME_PRINT_TABLE_CLASS}`]: {
          borderCollapse: "collapse",
          // Same length the font scale divides by. The print-media pass
          // records the laid-out columns here when they are wider than the
          // probe. `min(100%, ...)` keeps the border box in the column.
          width: `min(100%, var(${DATAFRAME_PRINT_WIDTH_VAR}))`,
          maxWidth: "100%",
          // Matches the font measured in buildDataFramePrintMeasure, then
          // shrinks it by the column-to-table ratio. Padding and images use
          // the same ratio so a nowrap cell still fits its column.
          fontFamily: theme.genericFonts.bodyFont,
          fontSize: `calc(${theme.fontSizes.md} * ${PRINT_FIT_RATIO})`,
          "th, td": {
            whiteSpace: "nowrap",
            padding: `calc(${theme.spacing.threeXS} * ${PRINT_FIT_RATIO}) calc(${theme.spacing.sm} * ${PRINT_FIT_RATIO})`,
            // An outline draws the grid without adding to the measured width.
            // `border: none` restores the medium border width, and a collapsed
            // table can keep that width. Zero it so the probe, which sets
            // border 0, matches the printed cells.
            borderWidth: 0,
            outline: `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`,
            textAlign: "left",
            fontWeight: theme.fontWeights.normal,
          },
          th: {
            fontWeight: theme.fontWeights.semiBold,
          },
          // The same box the off-screen probe measures, so a data URL is
          // not laid out as a line of text. The fit ratio keeps that box
          // in proportion with the type.
          img: {
            width: `calc(${theme.spacing.fourXL} * ${PRINT_FIT_RATIO})`,
            height: `calc(${theme.spacing.threeXL} * ${PRINT_FIT_RATIO})`,
            objectFit: "contain",
          },
        },
        [`& .${DATAFRAME_PRINT_NOTE_CLASS}`]: {
          margin: 0,
        },
        // A capped table keeps this note below the scaled grid, at body size.
        [`& .${DATAFRAME_PRINT_SCALE_CLASS} + .${DATAFRAME_PRINT_NOTE_CLASS}`]:
          {
            marginTop: theme.spacing.sm,
          },
        // The canvas only painted the on-screen viewport. The print table
        // is the full frame, so the canvas would clip columns beside it.
        [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS}) .stDataFrameResizable, &:has(.${DATAFRAME_PRINT_TABLE_CLASS}) .stElementToolbar`]:
          {
            display: "none !important",
          },
      },

      "& .dvn-scroller": {
        ["overflowX" as unknown as string]: "auto !important",
        ["overflowY" as unknown as string]: "auto !important",
        // This prevents accidental overscrolling that triggers the browser's Back button.
        overscrollBehaviorX: "contain",
      },
      "& .gdg-search-bar": {
        ...getPopoverContainerStyle(theme),
        // Make the search field more responsive to the grid width and use
        // rem units for everything.
        // 19rem is the closest rem without decimals to the original size:
        maxWidth: "19rem",
        width: "80%",
        // 6rem was manually determined as the smallest size thats still somewhat usable:
        minWidth: "6rem",
        top: theme.spacing.sm,
        right: theme.spacing.sm,
        padding: theme.spacing.sm,
        "& .gdg-search-status": {
          paddingTop: theme.spacing.twoXS,
          fontSize: theme.fontSizes.twoSm,
        },
        "& .gdg-search-progress": {
          // We are disabling the search progress bar since it
          // looks a bit weird in its current state and doesn't work
          // with rounded corners
          display: "none",
        },
        "& input": {
          width: "100%",
        },
        "& button": {
          width: theme.iconSizes.xl,
          height: theme.iconSizes.xl,
          "& .button-icon": {
            width: theme.iconSizes.base,
            height: theme.iconSizes.base,
          },
        },
      },
    })
  )
