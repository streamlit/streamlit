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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { isEqual } from "lodash-es"
import { flushSync } from "react-dom"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import {
  UploadedStatus,
  UploadFileInfo,
} from "~lib/components/shared/UploadedFile/UploadFileInfo"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useFormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { FileUploadClient } from "~lib/FileUploadClient"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import {
  type FileRejection,
  FileSize,
  getRejectedFileInfo,
  isFileTypeAllowed,
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

type FilesUpdater =
  | UploadFileInfo[]
  | ((prev: UploadFileInfo[]) => UploadFileInfo[])

/** Frontend-only key for File objects waiting for upload URLs across remount. */
export const PENDING_UPLOAD_FILES_STATE_KEY = "pendingUploadFiles"

const createUploadingFileInfo = (file: File, id: number): UploadFileInfo =>
  new UploadFileInfo(
    file.webkitRelativePath || file.name,
    file.size,
    id,
    {
      type: "uploading",
      abortController: new AbortController(),
      progress: 0,
    },
    file
  )

const createInitialFiles = (
  element: FileUploaderProto,
  widgetMgr: WidgetStateManager
): { files: UploadFileInfo[]; nextLocalId: number; pendingFiles: File[] } => {
  const widgetValue = widgetMgr.getFileUploaderStateValue(element)
  const pendingFiles =
    widgetMgr.getElementState<File[]>(
      element.id,
      PENDING_UPLOAD_FILES_STATE_KEY
    ) ?? []

  let nextLocalId = 1
  const uploadedFiles = (widgetValue?.uploadedFileInfo ?? []).map(f => {
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

  const pendingInfos = pendingFiles.map(file => {
    const info = createUploadingFileInfo(file, nextLocalId)
    nextLocalId += 1
    return info
  })

  return {
    files: [...uploadedFiles, ...pendingInfos],
    nextLocalId,
    pendingFiles,
  }
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

  const {
    files: initialFiles,
    nextLocalId: initialNextLocalId,
    pendingFiles,
  } = useMemo(
    () => createInitialFiles(element, widgetMgr),
    [element, widgetMgr]
  )

  const localFileIdCounterRef = useRef(initialNextLocalId)
  const [files, setFiles] = useState<UploadFileInfo[]>(() => initialFiles)
  const filesRef = useRef<UploadFileInfo[]>(files)
  const mountedRef = useRef(true)
  useEffect(() => {
    filesRef.current = files
  }, [files])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
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
    /* eslint-disable-next-line @eslint-react/dom-no-flush-sync --
     * Using flushSync here because we need the state to be immediately updated
     * before any subsequent file upload operations occur. Without this, React
     * can defer the commit and our upload callbacks (completion or abort) may
     * run while filesRef.current still points to the previous state. Those
     * callbacks rely on filesRef.current to locate the in-flight upload, so
     * deferring the update would cause them to no-op.
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
      /* eslint-disable-next-line @eslint-react/dom-no-flush-sync --
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
        element.id,
        toWidgetState(filesRef.current),
        {
          formId: element.formId,
          fragmentId,
          fromUser: false,
        }
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
      widgetMgr.setFileUploaderStateValue(element.id, newWidgetValue, {
        formId: element.formId,
        fragmentId,
        fromUser: true,
      })
    }

    // Keep pending Files until the widget is ready (upload finished or failed).
    // Clearing them when URL fetch settles would lose the batch if reconnect
    // remounts during the HTTP POST (#11419).
    widgetMgr.deleteElementState(element.id, PENDING_UPLOAD_FILES_STATE_KEY)
  }, [status, files, widgetMgr, element, fragmentId])

  const onFormCleared = useCallback((): void => {
    setFilesImmediate(() => [])
    widgetMgr.deleteElementState(element.id, PENDING_UPLOAD_FILES_STATE_KEY)
    const newWidgetValue = toWidgetState([])
    widgetMgr.setFileUploaderStateValue(element.id, newWidgetValue, {
      formId: element.formId,
      fragmentId,
      fromUser: true,
    })
  }, [element, fragmentId, setFilesImmediate, widgetMgr])

  useFormClearHelper({
    element,
    widgetMgr,
    onFormCleared,
  })

  const acceptedTypes = element.type

  const filterDirectoryFiles = useCallback(
    (
      filesToFilter: File[]
    ): { accepted: File[]; rejected: FileRejection[] } => {
      const accepted: File[] = []
      const rejected: FileRejection[] = []

      filesToFilter.forEach(file => {
        if (isFileTypeAllowed(file, acceptedTypes)) {
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
    [acceptedTypes]
  )

  /**
   * Update the file status when the upload has finished.
   */
  const onUploadComplete = useCallback(
    (localFileId: number, fileUrls: FileURLsProto.$Properties): void => {
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
   * Upload a file to the backend.
   */
  const uploadFile = useCallback(
    (
      fileURLs: FileURLsProto.$Properties,
      file: File,
      uploadingInfo: UploadFileInfo
    ): void => {
      if (uploadingInfo.status.type !== "uploading") {
        return
      }

      uploadClient
        .uploadFile(
          element,
          fileURLs.uploadUrl as string,
          file,
          undefined,
          uploadingInfo.status.abortController.signal
        )
        .then(() => onUploadComplete(uploadingInfo.id, fileURLs))
        .catch(err => {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            updateFile(
              uploadingInfo.id,
              uploadingInfo.setStatus({
                type: "error",
                errorMessage: err ? err.toString() : "Unknown error",
              })
            )
          }
        })
    },
    [element, onUploadComplete, updateFile, uploadClient]
  )

  const beginUploadsFromUrls = useCallback(
    (
      fileURLsArray: FileURLsProto.$Properties[],
      sourceFiles: File[],
      uploadingInfos: UploadFileInfo[]
    ): void => {
      fileURLsArray.forEach((fileURLs, index) => {
        const sourceFile = sourceFiles[index]
        const uploadingInfo = uploadingInfos[index]
        if (
          !sourceFile ||
          !uploadingInfo ||
          isNullOrUndefined(getFile(uploadingInfo.id))
        ) {
          return
        }
        uploadFile(fileURLs, sourceFile, uploadingInfo)
      })
    },
    [getFile, uploadFile]
  )

  const markUploadingFilesFailed = useCallback(
    (uploadingInfos: UploadFileInfo[], errorMessage: string): void => {
      uploadingInfos.forEach(info => {
        updateFile(
          info.id,
          info.setStatus({
            type: "error",
            errorMessage,
          })
        )
      })
    },
    [updateFile]
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

  const fetchUrlsAndUpload = useCallback(
    (sourceFiles: File[], uploadingInfos: UploadFileInfo[]): void => {
      void uploadClient
        .fetchFileURLs(sourceFiles, element.id)
        .then((fileURLsArray: FileURLsProto.$Properties[]) => {
          if (!mountedRef.current) {
            return
          }

          if (!element.multipleFiles) {
            const existingFile = filesRef.current.find(
              f =>
                f.status.type !== "error" &&
                !uploadingInfos.some(info => info.id === f.id)
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

          beginUploadsFromUrls(fileURLsArray, sourceFiles, uploadingInfos)
        })
        .catch((errorMessage: string) => {
          if (!mountedRef.current) {
            return
          }
          markUploadingFilesFailed(uploadingInfos, errorMessage)
        })
    },
    [
      beginUploadsFromUrls,
      deleteFile,
      element.id,
      element.multipleFiles,
      markUploadingFilesFailed,
      setForceUpdatingStatus,
      uploadClient,
    ]
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

      if (acceptedFiles.length > 0) {
        widgetMgr.setElementState(
          element.id,
          PENDING_UPLOAD_FILES_STATE_KEY,
          acceptedFiles
        )
        const uploadingInfos = acceptedFiles.map(file =>
          createUploadingFileInfo(file, nextLocalFileId())
        )
        addFiles(uploadingInfos)

        fetchUrlsAndUpload(acceptedFiles, uploadingInfos)
      }
    },
    [
      addFiles,
      element,
      fetchUrlsAndUpload,
      filterDirectoryFiles,
      maxUploadSizeInBytes,
      nextLocalFileId,
      widgetMgr,
    ]
  )

  /**
   * Resume in-flight uploads after a remount (reconnect can rebuild the tree).
   */
  useEffect(() => {
    if (pendingFiles.length === 0) {
      return
    }

    const pendingInfos = filesRef.current.filter(
      file =>
        file.status.type === "uploading" &&
        file.file &&
        pendingFiles.includes(file.file)
    )

    fetchUrlsAndUpload(pendingFiles, pendingInfos)
    // Resume only on mount; pendingFiles comes from the first render's widget state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only remount resume
  }, [])

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
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <FileDropzone
        onDrop={dropHandler}
        multiple={element.multipleFiles}
        acceptedTypes={acceptedTypes}
        maxSizeBytes={maxUploadSizeInBytes}
        label={element.label}
        disabled={disabled}
        // Keep the hidden input enabled across a disconnect so a picker
        // opened while connected can still deliver files (#11419).
        inputDisabled={element.disabled}
        acceptDirectory={Boolean(element.acceptDirectory)}
        hasFiles={files.length > 0}
        uploadedFiles={
          files.length > 0 ? (
            <UploadedFiles
              items={files}
              onDelete={deleteFile}
              disabled={disabled}
              trailingContent={
                <BaseButton
                  kind={BaseButtonKind.BORDERLESS_ICON}
                  disabled={disabled}
                  size={BaseButtonSize.XSMALL}
                  aria-label="Add files"
                >
                  <DynamicButtonLabel icon=":material/add:" />
                </BaseButton>
              }
            />
          ) : null
        }
      />
    </StyledFileUploader>
  )
}

export default memo(FileUploader)
