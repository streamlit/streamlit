/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import styled, { CSSObject } from "@emotion/styled"
import { EmotionTheme } from "src/theme"

export interface StyledDataFrameContainerProps {
  width: number
}

export const StyledDataFrameContainer =
  styled.div<StyledDataFrameContainerProps>(({ width, theme }) => ({
    width,
    border: `1px solid ${theme.colors.fadedText05}`,
    boxSizing: "content-box",

    "& .table-top-right": {
      // Hide scrollbar manually rather than with the hideTopRightGridScrollbar property of React
      // Multigrid because the latter does show a scrollbar in some cases, for some reason.
      overflow: "hidden !important",
      paddingRight: "6px", // Scrollbar size
    },

    "& .table-bottom-left": {
      // Hide scrollbar manually rather than with the hideTopRightGridScrollbar property of React
      // Multigrid because the latter does show a scrollbar in some cases, for some reason.
      overflow: "hidden !important",
      paddingBottom: "6px", // Scrollbar size
    },

    // Only this area should ever show a scrollbar.
    "& .table-bottom-right": {
      // Like all our scrollbar mods (see globalStyles.ts) this only works in Webkit and Blink.
      overflow: "overlay !important",
    },

    // Remove visible outline from click, since there's no click target/action anyway.
    "& .table-bottom-right:focus-visible": {
      outline: "none",
    },
    "& .table-bottom-right:focus": {
      outline: "none",
    },
  }))

const StyledDataFrameCell = styled.div(({ theme }) => ({
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  borderBottom: `1px solid ${theme.colors.fadedText05}`,
  borderRight: `1px solid ${theme.colors.fadedText05}`,
  fontSize: theme.fontSizes.md,
  fontFamily: theme.fonts.sansSerif,
  lineHeight: theme.lineHeights.table,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
}))

const headerCellFormatter = (theme: EmotionTheme): CSSObject => ({
  color: theme.colors.fadedText60,
  borderBottom: `1px solid ${theme.colors.fadedText05}`,
  borderRight: `1px solid ${theme.colors.fadedText05}`,
  zIndex: 1,
})

const cellTextFormatter = (theme: EmotionTheme): CSSObject => ({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  lineHeight: theme.lineHeights.table,
})

export const StyledDataFrameCornerCell = styled(StyledDataFrameCell)(
  ({ theme }) => headerCellFormatter(theme)
)

export const StyledDataFrameColHeaderCell = styled(StyledDataFrameCell)(
  ({ theme }) => ({
    /* Row headers are click-to-sort, so we make the text unselectable.
     Column headers are also unselectable, so that clicking to sort the
     column's row header doesn't result in the entire column being selected */
    userSelect: "none",
    ...headerCellFormatter(theme),
    ...cellTextFormatter(theme),
  })
)

export const StyledDataFrameRowHeaderCell = styled(StyledDataFrameCell)(
  ({ theme }) => ({
    /* Row headers are click-to-sort, so we make the text unselectable.
     Column headers are also unselectable, so that clicking to sort the
     column's row header doesn't result in the entire column being selected */
    userSelect: "none",
    ...headerCellFormatter(theme),
    ...cellTextFormatter(theme),
  })
)

export const StyledDataFrameDataCell = styled(StyledDataFrameCell)(
  ({ theme }) => cellTextFormatter(theme)
)

export interface StyledFixupProps {
  verticalLocator: "top" | "bottom"
  horizontalLocator: "left" | "right"
  width: number
  height: number
}

export const StyledFixup = styled.div<StyledFixupProps>(
  ({ verticalLocator, horizontalLocator, width, height }) => ({
    position: "absolute",
    [verticalLocator]: "0px",
    [horizontalLocator]: "0px",
    width,
    height,
  })
)

export const StyledEmptyDataframe = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.monospace,
  color: theme.colors.fadedText60,
  fontStyle: "italic",
  fontSize: theme.fontSizes.md,
  textAlign: "center",
}))

export const StyledSortIcon = styled.span(({ theme }) => ({
  color: theme.colors.fadedText05,
  verticalAlign: "top",
}))
