import React from "react"
import { CloudUpload } from "@emotion-icons/material-outlined"
import Icon from "src/components/shared/Icon"
import { FileSize, getSizeDisplay } from "src/lib/FileHelper"
import { Small } from "src/components/shared/TextElements"

import {
  StyledFileDropzoneInstructions,
  StyledFileDropzoneInstructionsFileUploaderIcon,
  StyledFileDropzoneInstructionsStyledSpan,
  StyledFileDropzoneInstructionsColumn,
} from "./styled-components"

export interface Props {
  multiple: boolean
  acceptedExtensions: string[]
  maxSizeBytes: number
}

const FileDropzoneInstructions = ({
  multiple,
  acceptedExtensions,
  maxSizeBytes,
}: Props): React.ReactElement => (
  <StyledFileDropzoneInstructions>
    <StyledFileDropzoneInstructionsFileUploaderIcon>
      <Icon content={CloudUpload} size="threeXL" />
    </StyledFileDropzoneInstructionsFileUploaderIcon>
    <StyledFileDropzoneInstructionsColumn>
      <StyledFileDropzoneInstructionsStyledSpan>
        Drag and drop file{multiple ? "s" : ""} here
      </StyledFileDropzoneInstructionsStyledSpan>
      <Small>
        {`Limit ${getSizeDisplay(maxSizeBytes, FileSize.Byte, 0)} per file`}
        {acceptedExtensions.length
          ? ` • ${acceptedExtensions
              .join(", ")
              .replace(/\./g, "")
              .toUpperCase()}`
          : null}
      </Small>
    </StyledFileDropzoneInstructionsColumn>
  </StyledFileDropzoneInstructions>
)

export default FileDropzoneInstructions
