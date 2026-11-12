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
import {
  printAllowSplitRules,
  printTableSplitRules,
} from "~lib/components/shared/printPageBreak"

import {
  DATAFRAME_PRINT_SLOT_CLASS,
  DATAFRAME_PRINT_TABLE_CLASS,
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
      // Top-align this inline-block. Baseline alignment leaves room for font
      // descenders in the parent's line box, so an auto-height parent renders
      // taller than the grid (default height, height="content", and a chart's
      // "Show data" table).
      verticalAlign: "top",
      height: "100%",

      // Filled in beforeprint with an HTML table of the visible rows. Hidden
      // on screen so the canvas grid is what the user interacts with.
      [`& .${DATAFRAME_PRINT_SLOT_CLASS}`]: {
        display: "none",
      },

      "@media print": {
        // Cap the on-screen pixel width so a wider grid does not spill the
        // printed card. A canvas without a print table still needs clipping.
        maxWidth: "100%",
        [`&:not(:has(.${DATAFRAME_PRINT_TABLE_CLASS}))`]: {
          overflow: "clip",
        },
        // When the print table is filled, it replaces the hidden canvas. Let
        // this box grow past its on-screen height and break across pages, so
        // the table continues instead of leaving a blank strip. The element
        // container also drops its reserved height, flex basis, and size
        // containment in print when this table is present.
        [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS})`]: {
          ...printAllowSplitRules,
          display: "block",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          height: "auto",
          maxHeight: "none",
          // Keep overflow visible so the table can fragment. Clip painting
          // to this box so extra columns are cut at the card instead of
          // spilling past the border.
          overflow: "visible",
          clipPath: "inset(0)",
        },
        [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS}) .stDataFrameResizable, &:has(.${DATAFRAME_PRINT_TABLE_CLASS}) .stElementToolbar`]:
          {
            display: "none",
          },
        [`& .${DATAFRAME_PRINT_SLOT_CLASS}`]: {
          display: "block",
          width: "100%",
          maxWidth: "100%",
        },
        [`& .${DATAFRAME_PRINT_TABLE_CLASS}`]: {
          borderCollapse: "collapse",
          // max-content is the table's intrinsic size, not a theme length.
          // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
          width: "max-content",
          maxWidth: "100%",
          fontFamily: theme.genericFonts.bodyFont,
          fontSize: theme.fontSizes.sm,
          ...printTableSplitRules,
          "th, td": {
            whiteSpace: "nowrap",
            // Bound long values (e.g. sparkline lists) like the grid's
            // column width does, so one cell cannot push later columns out.
            maxWidth: theme.sizes.tableColumnMaxWidth,
            overflow: "hidden",
            textOverflow: "ellipsis",
            padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
            border: `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`,
            textAlign: "left",
            fontWeight: theme.fontWeights.normal,
          },
          th: {
            fontWeight: theme.fontWeights.semiBold,
          },
          img: {
            display: "block",
            maxHeight: theme.iconSizes.xl,
            maxWidth: "100%",
          },
        },
      },

      "& .stDataFrameGlideDataEditor": {
        height: "100%",
        minWidth: "100%",
        minHeight: minHeight,
        borderRadius: theme.radii.default,
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
