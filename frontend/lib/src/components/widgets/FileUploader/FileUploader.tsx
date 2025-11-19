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

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import isEqual from "lodash/isEqual"
import zip from "lodash/zip"
import { flushSync } from "react-dom"
import { FileRejection } from "react-dropzone"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  IFileURLs,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import { useFormClearHelper } from "~lib/components/widgets/Form"
import { FileUploadClient } from "~lib/FileUploadClient"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import {
  FileSize,
  getRejectedFileInfo,
  sizeConverter,
} from "~lib/util/FileHelper"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import FileDropzone from "./FileDropzone"
import { StyledFileUploader } from "./styled-components"
import UploadedFiles from "./UploadedFiles"
import { UploadedStatus, UploadFileInfo } from "./UploadFileInfo"

type FilesUpdater =
  | UploadFileInfo[]
  | ((prev: UploadFileInfo[]) => UploadFileInfo[])

const createInitialFiles = (
  element: FileUploaderProto,
  widgetMgr: WidgetStateManager
): { files: UploadFileInfo[]; nextLocalId: number } => {
  const widgetValue = widgetMgr.getFileUploaderStateValue(element)
  if (isNullOrUndefined(widgetValue)) {
    return { files: [], nextLocalId: 1 }
  }

  const { uploadedFileInfo } = widgetValue
  if (isNullOrUndefined(uploadedFileInfo) || uploadedFileInfo.length === 0) {
    return { files: [], nextLocalId: 1 }
  }

  let nextLocalId = 1
  const files = uploadedFileInfo.map(f => {
    const name = f.name as string
    const size = f.size as number
    const fileId = f.fileId as string
    const fileUrls = f.fileUrls as FileURLsProto

    const uploadFile = new UploadFileInfo(name, size, nextLocalId, {
      type: "uploaded",
      fileId,
      fileUrls,
    })
    nextLocalId += 1
    return uploadFile
  })

  return { files, nextLocalId }
}

/**
 * Convert a list of uploaded file info to the widget state.
 */
const toWidgetState = (
  targetFiles: UploadFileInfo[]
): FileUploaderStateProto => {
  const uploadedFileInfo: UploadedFileInfoProto[] = targetFiles
    .filter(f => f.status.type === "uploaded")
    .map(f => {
      const { name, size, status } = f
      const { fileId, fileUrls } = status as UploadedStatus

      return new UploadedFileInfoProto({
        fileId,
        fileUrls,
        name,
        size,
      })
    })

  return new FileUploaderStateProto({ uploadedFileInfo })
}

type FileUploaderStatus =
  | "ready" // FileUploader can upload or delete files
  | "updating" // at least one file is being uploaded or deleted

export interface Props {
  disabled: boolean
  element: FileUploaderProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  fragmentId?: string
}

const FileUploader = ({
  disabled,
  element,
  widgetMgr,
  uploadClient,
  fragmentId,
}: Props): React.ReactElement => {
  const { width, elementRef } = useCalculatedDimensions()

  const { files: initialFiles, nextLocalId: initialNextLocalId } = useMemo(
    () => createInitialFiles(element, widgetMgr),
    [element, widgetMgr]
  )

  const localFileIdCounterRef = useRef(initialNextLocalId)
  const [files, setFiles] = useState<UploadFileInfo[]>(() => initialFiles)
  const filesRef = useRef<UploadFileInfo[]>(files)
  useEffect(() => {
    filesRef.current = files
  }, [files])
  const [isForceUpdating, setIsForceUpdating] = useState(false)

  /**
   * Generate a unique ID for a new file.
   */
  const nextLocalFileId = useCallback((): number => {
    const id = localFileIdCounterRef.current
    localFileIdCounterRef.current += 1
    return id
  }, [])

  const maxUploadSizeInBytes = useMemo(() => {
    const maxMbs = element.maxUploadSizeMb
    return sizeConverter(maxMbs, FileSize.Megabyte, FileSize.Byte)
  }, [element.maxUploadSizeMb])

  /**
   * Set the files immediately.
   */
  const setFilesImmediate = useCallback((updater: FilesUpdater): void => {
    /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
     * Using flushSync here because we need the state to be immediately updated
     * before any subsequent file upload operations occur. Without this, React
     * can defer the commit and our upload callbacks (progress, completion, or
     * abort) may run while filesRef.current still points to the previous state.
     * Those callbacks rely on filesRef.current to locate the in-flight upload,
     * so deferring the update would cause them to no-op and break progress
     * tracking.
     */
    flushSync(() => {
      setFiles(prev => {
        const next = typeof updater === "function" ? updater(prev) : updater
        filesRef.current = next
        return next
      })
    })
  }, [])

  const setForceUpdatingStatus = useCallback(
    (value: boolean): void => {
      /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
       * We need the status flag to update synchronously so that subsequent
       * renders treat the widget as updating. Otherwise, the status could
       * briefly report as ready and trigger widget state propagation while
       * we're still replacing an existing file.
       */
      flushSync(() => {
        setIsForceUpdating(value)
      })
    },
    [setIsForceUpdating]
  )

  /**
   * Add a file to the list of files.
   */
  const addFile = useCallback(
    (file: UploadFileInfo): void => {
      setFilesImmediate(prev => [...prev, file])
    },
    [setFilesImmediate]
  )

  /**
   * Add multiple files to the list of files.
   */
  const addFiles = useCallback(
    (filesToAdd: UploadFileInfo[]): void => {
      if (filesToAdd.length === 0) {
        return
      }
      setFilesImmediate(prev => [...prev, ...filesToAdd])
    },
    [setFilesImmediate]
  )

  /**
   * Remove a file from the list of files.
   */
  const removeFile = useCallback(
    (idToRemove: number): void => {
      setFilesImmediate(prev => prev.filter(file => file.id !== idToRemove))
    },
    [setFilesImmediate]
  )

  /**
   * Update a file in the list of files.
   */
  const updateFile = useCallback(
    (curFileId: number, newFile: UploadFileInfo): void => {
      setFilesImmediate(prev =>
        prev.map(file => (file.id === curFileId ? newFile : file))
      )
    },
    [setFilesImmediate]
  )

  const getFile = useCallback((fileId: number): UploadFileInfo | undefined => {
    return filesRef.current.find(file => file.id === fileId)
  }, [])

  const status: FileUploaderStatus =
    files.some(file => file.status.type === "uploading") || isForceUpdating
      ? "updating"
      : "ready"

  /**
   * Set the initial widget value on mount.
   */
  useEffect(() => {
    const prevWidgetValue = widgetMgr.getFileUploaderStateValue(element)
    if (prevWidgetValue === undefined) {
      widgetMgr.setFileUploaderStateValue(
        element,
        toWidgetState(filesRef.current),
        {
          fromUi: false,
        },
        fragmentId
      )
    }
  }, [widgetMgr, element, fragmentId])

  /**
   * Set the widget value when the status is ready.
   */
  useEffect(() => {
    if (status !== "ready") {
      return
    }

    const newWidgetValue = toWidgetState(files)
    const prevWidgetValue = widgetMgr.getFileUploaderStateValue(element)
    if (!isEqual(newWidgetValue, prevWidgetValue)) {
      widgetMgr.setFileUploaderStateValue(
        element,
        newWidgetValue,
        {
          fromUi: true,
        },
        fragmentId
      )
    }
  }, [status, files, widgetMgr, element, fragmentId])

  const onFormCleared = useCallback((): void => {
    setFilesImmediate(() => [])
    const newWidgetValue = toWidgetState([])
    widgetMgr.setFileUploaderStateValue(
      element,
      newWidgetValue,
      { fromUi: true },
      fragmentId
    )
  }, [element, fragmentId, setFilesImmediate, widgetMgr])

  useFormClearHelper({
    element,
    widgetMgr,
    onFormCleared,
  })

  /**
   * Check if the file type is allowed.
   */
  const isFileTypeAllowed = useCallback(
    (file: File): boolean => {
      const acceptedExtensions = element.type

      if (!acceptedExtensions || acceptedExtensions.length === 0) {
        return true
      }

      const fileName = file.name.toLowerCase()
      return acceptedExtensions.some(ext =>
        fileName.endsWith(ext.toLowerCase())
      )
    },
    [element.type]
  )

  const filterDirectoryFiles = useCallback(
    (
      filesToFilter: File[]
    ): { accepted: File[]; rejected: FileRejection[] } => {
      const accepted: File[] = []
      const rejected: FileRejection[] = []

      filesToFilter.forEach(file => {
        if (isFileTypeAllowed(file)) {
          accepted.push(file)
        } else {
          rejected.push({
            file,
            errors: [
              {
                code: "file-invalid-type",
                message: `${file.type} files are not allowed.`,
              },
            ],
          })
        }
      })

      return { accepted, rejected }
    },
    [isFileTypeAllowed]
  )

  /**
   * Update the file status when the upload has finished.
   */
  const onUploadComplete = useCallback(
    (localFileId: number, fileUrls: IFileURLs): void => {
      const curFile = getFile(localFileId)
      if (isNullOrUndefined(curFile) || curFile.status.type !== "uploading") {
        return
      }

      updateFile(
        curFile.id,
        curFile.setStatus({
          type: "uploaded",
          fileId: fileUrls.fileId as string,
          fileUrls,
        })
      )
    },
    [getFile, updateFile]
  )

  /**
   * Update the file status when the upload has progressed.
   */
  const onUploadProgress = useCallback(
    (event: ProgressEvent, fileId: number): void => {
      const file = getFile(fileId)
      if (isNullOrUndefined(file) || file.status.type !== "uploading") {
        return
      }

      const newProgress = Math.round((event.loaded * 100) / event.total)
      if (file.status.progress === newProgress) {
        return
      }

      updateFile(
        fileId,
        file.setStatus({
          type: "uploading",
          abortController: file.status.abortController,
          progress: newProgress,
        })
      )
    },
    [getFile, updateFile]
  )

  /**
   * Upload a file to the backend.
   */
  const uploadFile = useCallback(
    (fileURLs: IFileURLs, file: File): void => {
      const abortController = new AbortController()
      const fileName = file.webkitRelativePath || file.name

      const uploadingFileInfo = new UploadFileInfo(
        fileName,
        file.size,
        nextLocalFileId(),
        {
          type: "uploading",
          abortController,
          progress: 1,
        }
      )
      addFile(uploadingFileInfo)

      uploadClient
        .uploadFile(
          element,
          fileURLs.uploadUrl as string,
          file,
          e => onUploadProgress(e, uploadingFileInfo.id),
          abortController.signal
        )
        .then(() => onUploadComplete(uploadingFileInfo.id, fileURLs))
        .catch(err => {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            updateFile(
              uploadingFileInfo.id,
              uploadingFileInfo.setStatus({
                type: "error",
                errorMessage: err ? err.toString() : "Unknown error",
              })
            )
          }
        })
    },
    [
      addFile,
      element,
      nextLocalFileId,
      onUploadComplete,
      onUploadProgress,
      updateFile,
      uploadClient,
    ]
  )

  /**
   * Delete a file from the backend and client.
   */
  const deleteFile = useCallback(
    (fileId: number): void => {
      if (disabled) {
        return
      }

      const file = getFile(fileId)
      if (isNullOrUndefined(file)) {
        return
      }

      if (file.status.type === "uploading") {
        file.status.abortController.abort()
      }

      if (file.status.type === "uploaded" && file.status.fileUrls.deleteUrl) {
        void uploadClient.deleteFile(file.status.fileUrls.deleteUrl)
      }

      removeFile(fileId)
    },
    [disabled, getFile, removeFile, uploadClient]
  )

  /**
   * Handle the drag-and-drop event for file-upload.
   */
  const dropHandler = useCallback(
    (
      acceptedFilesParam: File[],
      rejectedFilesParam: FileRejection[]
    ): void => {
      const { multipleFiles } = element
      const isDirectoryUpload = Boolean(element.acceptDirectory)

      let acceptedFiles = [...acceptedFilesParam]
      let rejectedFiles = [...rejectedFilesParam]

      if (isDirectoryUpload && acceptedFiles.length > 0) {
        const { accepted, rejected } = filterDirectoryFiles(acceptedFiles)
        acceptedFiles = accepted
        rejectedFiles = [...rejectedFiles, ...rejected]
      }

      if (
        !multipleFiles &&
        acceptedFiles.length === 0 &&
        rejectedFiles.length > 1
      ) {
        const firstFileIndex = rejectedFiles.findIndex(
          file =>
            file.errors.length === 1 &&
            file.errors[0].code === "too-many-files"
        )

        if (firstFileIndex >= 0) {
          acceptedFiles.push(rejectedFiles[firstFileIndex].file)
          rejectedFiles.splice(firstFileIndex, 1)
        }
      }

      uploadClient
        .fetchFileURLs(acceptedFiles)
        .then((fileURLsArray: IFileURLs[]) => {
          if (!multipleFiles && acceptedFiles.length > 0) {
            const existingFile = filesRef.current.find(
              f => f.status.type !== "error"
            )
            if (existingFile) {
              setForceUpdatingStatus(true)
              try {
                deleteFile(existingFile.id)
              } finally {
                setForceUpdatingStatus(false)
              }
            }
          }

          zip(fileURLsArray, acceptedFiles).forEach(
            ([fileURLs, acceptedFile]) => {
              uploadFile(fileURLs as FileURLsProto, acceptedFile as File)
            }
          )
        })
        .catch((errorMessage: string) => {
          addFiles(
            acceptedFiles.map(
              f =>
                new UploadFileInfo(f.name, f.size, nextLocalFileId(), {
                  type: "error",
                  errorMessage,
                })
            )
          )
        })

      if (rejectedFiles.length > 0) {
        const rejectedInfos = rejectedFiles.map(rejected =>
          getRejectedFileInfo(
            rejected,
            nextLocalFileId(),
            maxUploadSizeInBytes
          )
        )
        addFiles(rejectedInfos)
      }
    },
    [
      addFiles,
      deleteFile,
      element,
      filterDirectoryFiles,
      maxUploadSizeInBytes,
      nextLocalFileId,
      uploadClient,
      uploadFile,
      setForceUpdatingStatus,
    ]
  )

  const newestToOldestFiles = useMemo(() => {
    return files.slice().reverse()
  }, [files])

  const acceptedExtensions = element.type

  return (
    <StyledFileUploader
      className="stFileUploader"
      data-testid="stFileUploader"
      width={width}
      ref={elementRef}
    >
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
        )}
      </WidgetLabel>
      <FileDropzone
        onDrop={dropHandler}
        multiple={element.multipleFiles}
        acceptedExtensions={acceptedExtensions}
        maxSizeBytes={maxUploadSizeInBytes}
        label={element.label}
        disabled={disabled}
        acceptDirectory={Boolean(element.acceptDirectory)}
      />
      {newestToOldestFiles.length > 0 && (
        <UploadedFiles
          items={newestToOldestFiles}
          pageSize={3}
          onDelete={deleteFile}
          resetOnAdd
          disabled={disabled}
        />
      )}
    </StyledFileUploader>
  )
}

export default memo(FileUploader)
