/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { memo } from "react"

import { FileSize, getSizeDisplay } from "~lib/util/FileHelper"
import { convertRemToPx } from "~lib/theme"

import {
  StyledFileDropzoneInstructions,
  StyledFileDropzoneInstructionsText,
} from "./styled-components"

export interface Props {
  acceptedExtensions: string[]
  maxSizeBytes: number
  disabled?: boolean
  width: number
}

const FileDropzoneInstructions = ({
  acceptedExtensions,
  maxSizeBytes,
  disabled,
  width,
}: Props): React.ReactElement => {
  // Define breakpoints for different modes
  const MEDIUM_BREAKPOINT = convertRemToPx("30rem")
  const SMALL_BREAKPOINT = convertRemToPx("23rem")

  // Extensions that are redundant and should be hidden in UI
  const REDUNDANT_EXTENSIONS = ["jpeg", "mpeg", "mpeg4", "tiff", "html"]

  // Filter out only the redundant extensions
  const displayExtensions = acceptedExtensions.filter(ext => {
    const normalized = ext.replace(/^\./, "").toLowerCase()
    return !REDUNDANT_EXTENSIONS.includes(normalized)
  })

  // Format extensions once
  const extensionsText = displayExtensions.length
    ? displayExtensions
        .map(ext => ext.replace(/^\./, "").toUpperCase())
        .join(", ")
    : ""

  // Build the instruction text based on width
  let text = ""

  if (width < SMALL_BREAKPOINT) {
    // Small mode (<23rem): show extensions, or size limit if no extensions
    if (extensionsText) {
      text = extensionsText
    } else {
      text = `${getSizeDisplay(maxSizeBytes, FileSize.Byte, 0)} per file`
    }
  } else if (width < MEDIUM_BREAKPOINT) {
    // Medium mode (23-30rem): show size limit and extensions
    text = `${getSizeDisplay(maxSizeBytes, FileSize.Byte, 0)} per file`

    if (extensionsText) {
      text += ` • ${extensionsText}`
    }
  } else {
    // Full mode (≥30rem): show everything
    text = `Or drag and drop • ${getSizeDisplay(maxSizeBytes, FileSize.Byte, 0)} per file`

    if (extensionsText) {
      text += ` • ${extensionsText}`
    }
  }

  return (
    <StyledFileDropzoneInstructions data-testid="stFileUploaderDropzoneInstructions">
      <StyledFileDropzoneInstructionsText disabled={disabled}>
        {text}
      </StyledFileDropzoneInstructionsText>
    </StyledFileDropzoneInstructions>
  )
}

export default memo(FileDropzoneInstructions)
