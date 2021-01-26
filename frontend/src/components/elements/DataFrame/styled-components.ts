/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import styled, { CSSObject } from "@emotion/styled"
import { transparentize } from "color2k"
import { Theme } from "theme"

export interface StyledDataFrameContainerProps {
  width: number
}

export const StyledDataFrameContainer = styled.div<
  StyledDataFrameContainerProps
>(({ width, theme }) => ({
  width,
  border: `1px solid ${theme.colors.lightestGray}`,
  boxSizing: "content-box",

  "& .table-top-right": {
    overflowX: "hidden",
    backgroundColor: theme.colors.lightestGray,
  },
  "& .table-bottom-left": {
    overflowY: "hidden",
    backgroundColor: theme.colors.lightestGray,
  },
}))

const StyledDataFrameCell = styled.div(({ theme }) => ({
  padding: theme.spacing.sm,
  fontSize: theme.fontSizes.smDefault,
  fontFamily: theme.fonts.mono,
  textAlign: "right",
  lineHeight: theme.lineHeights.none,
}))

const headerCellFormatter = (theme: Theme): CSSObject => ({
  backgroundColor: theme.colors.lightestGray,
  color: theme.colors.darkGray,
  zIndex: 1,
})

const cellTextFormatter = (theme: Theme): CSSObject => ({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  lineHeight: theme.lineHeights.dataframeCell,
})

export const StyledDataFrameCornerCell = styled(
  StyledDataFrameCell
)(({ theme }) => headerCellFormatter(theme))

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

export const StyledDataFrameDataCell = styled(
  StyledDataFrameCell
)(({ theme }) => cellTextFormatter(theme))

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
  fontFamily: theme.fonts.mono,
  color: theme.colors.darkGray,
  fontStyle: "italic",
  fontSize: theme.fontSizes.smDefault,
  textAlign: "center",
}))

export const StyledSortIcon = styled.span(({ theme }) => ({
  color: transparentize(theme.colors.darkGray, 0.7),
  verticalAlign: "top",
}))
