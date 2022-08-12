import React from "react"
import Dropzone, { FileRejection } from "react-dropzone"
import Button, { Kind, Size } from "src/components/shared/Button"

import { StyledFileDropzoneSection } from "./styled-components"
import FileDropzoneInstructions from "./FileDropzoneInstructions"

export interface Props {
  disabled: boolean
  onDrop: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void
  multiple: boolean
  acceptedExtensions: string[]
  maxSizeBytes: number
  label: string
}

const FileDropzone = ({
  onDrop,
  multiple,
  acceptedExtensions,
  maxSizeBytes,
  disabled,
  label,
}: Props): React.ReactElement => (
  <Dropzone
    onDrop={onDrop}
    multiple={multiple}
    accept={acceptedExtensions.length ? acceptedExtensions : undefined}
    maxSize={maxSizeBytes}
    disabled={disabled}
  >
    {({ getRootProps, getInputProps }) => (
      <StyledFileDropzoneSection
        {...getRootProps()}
        data-testid="stFileUploadDropzone"
        isDisabled={disabled}
        aria-label={label}
      >
        <input {...getInputProps()} />
        <FileDropzoneInstructions
          multiple={multiple}
          acceptedExtensions={acceptedExtensions}
          maxSizeBytes={maxSizeBytes}
        />
        <Button kind={Kind.PRIMARY} disabled={disabled} size={Size.SMALL}>
          Browse files
        </Button>
      </StyledFileDropzoneSection>
    )}
  </Dropzone>
)

export default FileDropzone
