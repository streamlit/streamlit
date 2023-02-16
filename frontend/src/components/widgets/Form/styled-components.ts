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
import { getBlackWhenLightBackgroundWhiteOtherwise } from "src/theme"

export const StyledFormSubmitContent = styled.div(() => ({
  display: "flex",
}))

export const StyledForm = styled.div(({ theme }) => ({
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: theme.radii.md,
  padding: "calc(1em - 1px)", // 1px to account for border.
}))

export const StyledErrorContainer = styled.div(({ theme }) => ({
  marginTop: theme.spacing.lg,
}))

export const StyledModalCloseButtonWrapper = styled.div(({ theme }) => ({
  position: "fixed",
  bottom: "12px",
  right: "13px",
  zIndex: theme.zIndices.modalButtons,
}))

export const StyledModalCloseIconButton = styled.button(({ theme }) => ({
  border: "none",
  background: "none",
  outline: "none",
  ":focus": {
    border: "none",
    background: "none",
    outline: "none",
  },
  ":hover": {
    cursor: "pointer",
  },
  svg: {
    color: getBlackWhenLightBackgroundWhiteOtherwise(theme),
    ":hover": {
      cursor: "pointer",
    },
  },
  position: "fixed",
  top: "1em",
  right: "1em",
  zIndex: theme.zIndices.modalButtons,
}))
