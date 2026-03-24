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

// A transparent dropzone overlay that covers the ContentArea
export const StyledChatFileUploadDropzone = styled.div(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  position: "absolute",
  inset: 0,
  zIndex: theme.zIndices.priority,
  borderRadius: theme.radii.chatInput,
}))

export const StyledChatFileUploadDropzoneLabel = styled.div(({ theme }) => ({
  position: "absolute",
  inset: 0, // Cover the area
  border: `${theme.sizes.borderWidth} solid`,
  borderColor: theme.colors.primary,
  borderRadius: theme.radii.chatInput,
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.primary,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: theme.fontWeights.bold,
  pointerEvents: "none", // Pass events through to the dropzone
  zIndex: theme.zIndices.priority, // Ensure it's visible
}))

interface StyledFileUploadButtonProps {
  disabled: boolean
}

export const StyledFileUploadButton = styled.div<StyledFileUploadButtonProps>(
  ({ disabled }) => ({
    pointerEvents: disabled ? "none" : "auto",
  })
)
