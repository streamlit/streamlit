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

import styled from "@emotion/styled"

import { LabelVisibilityOptions } from "src/lib/utils"

export interface StyledWidgetProps {
  disabled?: boolean | null
  labelVisibility?: LabelVisibilityOptions
}

export const StyledWidgetLabel = styled.label<StyledWidgetProps>(
  ({ disabled, labelVisibility, theme }) => ({
    fontSize: theme.fontSizes.sm,
    color: disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
    display:
      labelVisibility === LabelVisibilityOptions.Collapsed ? "none" : "flex",
    visibility:
      labelVisibility === LabelVisibilityOptions.Hidden ? "hidden" : "visible",
    marginBottom: theme.spacing.sm,
    height: "auto",
    minHeight: theme.fontSizes.xl,
    verticalAlign: "middle",
    flexDirection: "row",
    alignItems: "center",
    // Handles labels with invalid markdown - ReactMarkdown wraps the text in a div
    div: {
      display: "inline-block",
    },
  })
)

export const StyledWidgetLabelHelp = styled.div(() => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-end",
  flex: 1,
}))

export const StyledWidgetInstructions = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.fadedText60,
  margin: theme.spacing.none,
  textAlign: "right",
  position: "absolute",
  bottom: 0,
  right: theme.spacing.halfSmFont,
}))

export const StyledWidgetLabelHelpInline = styled.label(({ theme }) => ({
  marginLeft: theme.spacing.xs,
  position: "relative",
  display: "flex",
  flexDirection: "row",
}))
