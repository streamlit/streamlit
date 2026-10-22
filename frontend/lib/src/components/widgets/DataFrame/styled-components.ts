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
import { printContainStyles } from "~lib/components/shared/printContain"
import {
  DATAFRAME_PRINT_TABLE_CLASS,
  DATAFRAME_PRINT_WIDTH_VAR,
} from "~lib/components/widgets/DataFrame/printDataFrame"

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
          // Used when no print table was built. A print table replaces the
          // canvas so every column can be scaled onto the page.
          width: "100% !important",
          maxWidth: "100% !important",
        },
      },

      // Filled in beforeprint with an HTML table of the whole dataframe.
      // Hidden on screen so the canvas grid is what the user interacts with.
      "& .stDataFramePrintSlot": {
        display: "none",
      },

      "@media print": {
        // The grid locks the on-screen pixel width. Cap the container so a
        // narrower page does not spill it, and let the print table scale
        // inside that width.
        ...printContainStyles["@media print"],
        // On screen this shrinks to the grid. The print slot has no
        // intrinsic width, so a shrink-to-fit box would collapse to zero
        // and the table could not be scaled to the column.
        display: "block",
        width: "100%",
        "& .stDataFramePrintSlot": {
          display: "block",
          width: "100%",
          // The table's natural width is wider than the page. This slot is
          // the printed column, and the table scales down to it. The slot
          // stays as tall as that table, including a header repeated after
          // a page break, so the bordered container wraps every row.
          containerType: "inline-size",
        },
        [`& .${DATAFRAME_PRINT_TABLE_CLASS}`]: {
          zoom: `min(1, calc(100cqw / var(${DATAFRAME_PRINT_WIDTH_VAR})))`,
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
