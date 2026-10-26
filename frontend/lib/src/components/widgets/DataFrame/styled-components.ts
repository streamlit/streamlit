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
import { printContainRules } from "~lib/components/shared/printContain"

import {
  DATAFRAME_PRINT_NOTE_CLASS,
  DATAFRAME_PRINT_SCALE_CLASS,
  DATAFRAME_PRINT_SLOT_CLASS,
  DATAFRAME_PRINT_TABLE_CLASS,
  DATAFRAME_PRINT_WIDTH_VAR,
} from "./printClassNames"

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
        // narrower page does not spill it. A fixed or content width stays
        // that size when the canvas is the fallback.
        ...printContainRules,
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
          // The wrapper is the measured table width, then zoom shrinks that
          // box. Zoom on the table leaves Chromium's border box unscaled, so
          // the slot would stay at the natural width and the table would
          // paint past the column. `100cqw` is the slot, which is the column.
          width: `var(${DATAFRAME_PRINT_WIDTH_VAR})`,
          // `zoom` needs a number. Dividing the column width by the table
          // width inside `calc()` needs typed arithmetic, which older
          // browsers drop, so the table would print unscaled. `atan2` takes
          // the two lengths and `tan` turns that angle back into the ratio.
          // `beforeprint` also sets a unitless inline zoom from the visible
          // dataframe, and again when print media starts. The slot is
          // display:none until then, so it has no width of its own.
          zoom: `min(1, tan(atan2(100cqw, var(${DATAFRAME_PRINT_WIDTH_VAR}))))`,
        },
        [`& .${DATAFRAME_PRINT_TABLE_CLASS}`]: {
          borderCollapse: "collapse",
          // Same length the zoom divides by. The print-media pass records
          // the laid-out columns here when they are wider than the probe.
          width: `var(${DATAFRAME_PRINT_WIDTH_VAR})`,
          // Matches the font measured in buildDataFramePrintMeasure.
          fontFamily: theme.genericFonts.bodyFont,
          fontSize: theme.fontSizes.md,
          "th, td": {
            whiteSpace: "nowrap",
            padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
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
          // not laid out as a line of text.
          img: {
            width: theme.spacing.fourXL,
            height: theme.spacing.threeXL,
            objectFit: "contain",
          },
        },
        [`& .${DATAFRAME_PRINT_NOTE_CLASS}`]: {
          margin: 0,
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
