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

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { X } from "@emotion-icons/open-iconic"
import type { AxiosProgressEvent } from "axios"
import { isEqual } from "lodash-es"
import { getLogger } from "loglevel"
import { flushSync } from "react-dom"

import {
  CameraInput as CameraInputProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  IFileURLs,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

import Icon from "~lib/components/shared/Icon/Icon"
import {
  UploadedStatus,
  UploadFileInfo,
  UploadingStatus,
} from "~lib/components/shared/UploadedFile/UploadFileInfo"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useFormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { FileUploadClient } from "~lib/FileUploadClient"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import useTimeout from "~lib/hooks/useTimeout"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import CameraInputButton from "./CameraInputButton"
import {
  StyledBox,
  StyledCameraInput,
  StyledImg,
  StyledSpan,
} from "./styled-components"
import { FacingMode } from "./SwitchFacingModeButton"
import WebcamComponent, { WebcamPermission } from "./WebcamComponent"

const RESTORED_FROM_WIDGET_STRING = "RESTORED_FROM_WIDGET"
const MIN_SHUTTER_EFFECT_TIME_MS = 150
const LOG = getLogger("CameraInput")

type FileUploaderStatus =
  | "ready" // FileUploader can upload or delete files
  | "updating" // at least one file is being uploaded or deleted

export interface Props {
  element: CameraInputProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  disabled: boolean
  fragmentId?: string
  // Allow for unit testing
  testOverride?: WebcamPermission
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

/**
 * Create the initial files and next local ID from the widget state.
 */
const createInitialFiles = (
  element: CameraInputProto,
  widgetMgr: WidgetStateManager
): { files: UploadFileInfo[]; nextLocalId: number; imgSrc: string | null } => {
  const widgetValue = widgetMgr.getFileUploaderStateValue(element)
  if (isNullOrUndefined(widgetValue)) {
    return { files: [], nextLocalId: 1, imgSrc: null }
  }

  const { uploadedFileInfo } = widgetValue
  if (isNullOrUndefined(uploadedFileInfo) || uploadedFileInfo.length === 0) {
    return { files: [], nextLocalId: 1, imgSrc: null }
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

  return {
    files,
    nextLocalId,
    imgSrc: files.length > 0 ? RESTORED_FROM_WIDGET_STRING : null,
  }
}

function urltoFile(url: string, filename: string): Promise<File> {
  return fetch(url)
    .then(res => res.arrayBuffer())
    .then(buf => new File([buf], filename, { type: "image/jpeg" }))
}

const CameraInput = ({
  element,
  widgetMgr,
  uploadClient,
  disabled,
  fragmentId,
  testOverride,
}: Props): React.ReactElement => {
  /**
   * TODO: This component should be refactored to remove the width calculation
   * from JS entirely and instead utilize width: 100%; height: 100%;
   * aspect-ratio: 16 / 9; on the StyledBox CSS instead.
   */
  const { width, elementRef } = useCalculatedDimensions()

  // Initialize files and local ID counter from widget state.
  // Use ref with lazy initialization to guarantee one-time computation.
  const initialStateRef = useRef<ReturnType<typeof createInitialFiles> | null>(
    null
  )
  if (initialStateRef.current === null) {
    initialStateRef.current = createInitialFiles(element, widgetMgr)
  }
  const {
    files: initialFiles,
    nextLocalId: initialNextLocalId,
    imgSrc: initialImgSrc,
  } = initialStateRef.current

  const localFileIdCounterRef = useRef(initialNextLocalId)

  // Files and imgSrc use regular useState to ensure they always reflect widget value on mount
  // (matching FileUploader behavior)
  const [files, setFiles] = useState(() => initialFiles)
  // Keep a ref to the current files for use in callbacks that need current state.
  // useLayoutEffect ensures the ref is updated synchronously after render,
  // which is critical for flushSync in addFile to work correctly.
  const filesRef = useRef(files)
  useLayoutEffect(() => {
    filesRef.current = files
  }, [files])

  const [imgSrc, setImgSrc] = useState(() => initialImgSrc)

  // UI state uses useWidgetManagerElementState for persistence across mounts
  const [shutter, setShutter] = useState(false)
  const [minShutterEffectPassed, setMinShutterEffectPassed] = useState(true)
  const [clearPhotoInProgress, setClearPhotoInProgress] = useState(false)
  const [facingMode, setFacingMode] = useState(FacingMode.USER)
  const minShutterEffectResolversRef = useRef<Array<() => void>>([])
  const captureInFlightRef = useRef<Promise<void> | null>(null)

  const resolveMinShutterEffectWaiters = useCallback((): void => {
    if (minShutterEffectResolversRef.current.length === 0) {
      return
    }

    minShutterEffectResolversRef.current.forEach(resolve => resolve())
    minShutterEffectResolversRef.current = []
  }, [])

  const {
    clear: clearMinShutterEffectTimeout,
    restart: restartMinShutterEffectTimeout,
  } = useTimeout(
    () => {
      resolveMinShutterEffectWaiters()
    },
    MIN_SHUTTER_EFFECT_TIME_MS,
    { autoStart: false }
  )

  const waitForMinShutterEffect = useCallback((): Promise<void> => {
    return new Promise(resolve => {
      minShutterEffectResolversRef.current.push(resolve)
      restartMinShutterEffectTimeout()
    })
  }, [restartMinShutterEffectTimeout])

  useEffect(() => {
    return () => {
      clearMinShutterEffectTimeout()
      resolveMinShutterEffectWaiters()
      captureInFlightRef.current = null
    }
  }, [clearMinShutterEffectTimeout, resolveMinShutterEffectWaiters])

  /**
   * Generate a unique ID for a new file.
   */
  const nextLocalFileId = useCallback((): number => {
    const id = localFileIdCounterRef.current
    localFileIdCounterRef.current += 1
    return id
  }, [])

  /**
   * Return the component's current status, which is derived from its state.
   */
  const status: FileUploaderStatus = useMemo(() => {
    const isFileUpdating = (file: UploadFileInfo): boolean =>
      file.status.type === "uploading"

    // If any of our files is Uploading, then we're currently updating.
    if (files.some(isFileUpdating)) {
      return "updating"
    }

    return "ready"
  }, [files])

  /**
   * Upload progress for the current file, derived during render.
   */
  const progress: number | undefined = useMemo(() => {
    if (
      files.length > 0 &&
      files[files.length - 1].status.type === "uploading"
    ) {
      const lastFileStatus = files[files.length - 1].status as UploadingStatus
      return lastFileStatus.progress
    }
    return undefined
  }, [files])

  /**
   * Toggle between front and back camera.
   */
  const handleSetFacingMode = useCallback((): void => {
    setFacingMode(prevMode =>
      prevMode === FacingMode.USER ? FacingMode.ENVIRONMENT : FacingMode.USER
    )
  }, [])

  /**
   * Get a file by its local ID.
   * Uses filesRef to always access the current state in async callbacks.
   */
  const getFile = useCallback(
    (fileId: number): UploadFileInfo | undefined =>
      filesRef.current.find(file => file.id === fileId),
    []
  )

  /**
   * Add a file to the list of files.
   */
  const addFile = useCallback((file: UploadFileInfo): void => {
    /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
     * Using flushSync here because we need the state to be immediately updated
     * before any subsequent file upload operations occur. Without this, React
     * can defer the commit and our upload callbacks (progress, completion, or
     * abort) may run while filesRef.current still points to the previous state.
     * Those callbacks rely on filesRef.current to locate the in-flight upload,
     * so deferring the update would cause them to no-op and break progress
     * tracking. The useLayoutEffect that syncs filesRef runs synchronously
     * after the flushSync-triggered render completes.
     */
    flushSync(() => {
      setFiles(prevFiles => [...prevFiles, file])
    })
  }, [])

  /**
   * Remove a file from the list by its local ID.
   */
  const removeFile = useCallback((idToRemove: number): void => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== idToRemove))
  }, [])

  /**
   * Update a file in the list by its local ID.
   */
  const updateFile = useCallback(
    (curFileId: number, newFile: UploadFileInfo): void => {
      setFiles(prevFiles =>
        prevFiles.map(file => (file.id === curFileId ? newFile : file))
      )
    },
    []
  )

  /**
   * Called when an upload has completed. Updates the file's status.
   */
  const onUploadComplete = useCallback(
    (localFileId: number, fileUrls: IFileURLs): void => {
      setShutter(false)

      const curFile = getFile(localFileId)
      if (isNullOrUndefined(curFile) || curFile.status.type !== "uploading") {
        // The file may have been canceled right before the upload
        // completed. In this case, we just bail.
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
   * Callback for file upload progress. Updates a single file's local progress state.
   */
  const onUploadProgress = useCallback(
    (event: AxiosProgressEvent, fileId: number): void => {
      const file = getFile(fileId)
      if (isNullOrUndefined(file) || file.status.type !== "uploading") {
        return
      }

      const newProgress = event.total
        ? Math.round((event.loaded * 100) / event.total)
        : 0
      if (file.status.progress === newProgress) {
        return
      }

      // Update file.progress
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
      // Create an UploadFileInfo for this file and add it to our state.
      const abortController = new AbortController()
      const uploadingFileInfo = new UploadFileInfo(
        file.name,
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
          // If this was an abort error, we don't show the user an error -
          // the cancellation was in response to an action they took.
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
   * Delete the file with the given ID:
   * - Cancel the file upload if it's in progress
   * - Remove the fileID from our local state
   * We don't actually tell the server to delete the file. It will garbage collect it.
   */
  const deleteFile = useCallback(
    (fileId: number): void => {
      const file = getFile(fileId)
      if (isNullOrUndefined(file)) {
        return
      }

      if (file.status.type === "uploading") {
        // The file hasn't been uploaded. Let's cancel the request.
        // However, it may have been received by the server so we'll still
        // send out a request to delete.
        file.status.abortController.abort()
      }

      if (file.status.type === "uploaded" && file.status.fileUrls.deleteUrl) {
        // Fire and forget deletion
        void uploadClient.deleteFile(file.status.fileUrls.deleteUrl)
      }
      removeFile(fileId)
    },
    [getFile, removeFile, uploadClient]
  )

  /**
   * Handle the capture of a photo. Returns a Promise for internal use.
   */
  const handleCaptureAsync = useCallback(
    (capturedImgSrc: string | null): Promise<void> => {
      if (capturedImgSrc === null) {
        return Promise.resolve()
      }

      if (captureInFlightRef.current) {
        return captureInFlightRef.current
      }

      setImgSrc(capturedImgSrc)
      setShutter(true)
      setMinShutterEffectPassed(false)

      const capturePromise = urltoFile(
        capturedImgSrc,
        `camera-input-${new Date().toISOString().replace(/:/g, "_")}.jpg`
      )
        .then(file =>
          uploadClient.fetchFileURLs([file]).then(fileURLsArray => ({
            file: file,
            fileUrls: fileURLsArray[0],
          }))
        )
        .then(({ file, fileUrls }) => uploadFile(fileUrls, file))
        .then(waitForMinShutterEffect)
        .then(() => {
          setMinShutterEffectPassed(true)
        })
        .catch(err => {
          LOG.error(err)
        })
        .finally(() => {
          captureInFlightRef.current = null
        })

      captureInFlightRef.current = capturePromise
      return capturePromise
    },
    [uploadClient, uploadFile, waitForMinShutterEffect]
  )

  /**
   * Wrapper for handleCaptureAsync that doesn't return a promise.
   * Used as event handler for WebcamComponent.
   */
  const handleCapture = useCallback(
    (capturedImgSrc: string | null): void => {
      void handleCaptureAsync(capturedImgSrc)
    },
    [handleCaptureAsync]
  )

  /**
   * Remove the captured photo.
   */
  const removeCapture = useCallback((): void => {
    if (files.length === 0) {
      return
    }

    files.forEach(file => deleteFile(file.id))

    setImgSrc(null)
    setClearPhotoInProgress(true)
  }, [files, deleteFile])

  /**
   * Set the initial widget value on mount.
   */
  useEffect(() => {
    const prevWidgetValue = widgetMgr.getFileUploaderStateValue(element)
    if (prevWidgetValue === undefined) {
      widgetMgr.setFileUploaderStateValue(
        element,
        toWidgetState(files),
        {
          fromUi: false,
        },
        fragmentId
      )
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Set the widget value when the status is ready.
   */
  useEffect(() => {
    // If we're part of a form and our status is not "ready",
    // then we have uploads in progress.
    // We won't submit a new widgetValue until all uploads have resolved.
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

  /**
   * Handle form clear event - reset state when the form is cleared.
   */
  const onFormCleared = useCallback((): void => {
    setFiles([])
    setImgSrc(null)

    const newWidgetValue = toWidgetState([])
    widgetMgr.setFileUploaderStateValue(
      element,
      newWidgetValue,
      { fromUi: true },
      fragmentId
    )
  }, [element, fragmentId, widgetMgr])

  useFormClearHelper({
    element,
    widgetMgr,
    onFormCleared,
  })

  return (
    <StyledCameraInput
      className="stCameraInput"
      data-testid="stCameraInput"
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
      {imgSrc ? (
        <>
          <StyledBox width={width}>
            {imgSrc !== RESTORED_FROM_WIDGET_STRING && (
              <StyledImg
                src={imgSrc}
                alt="Snapshot"
                opacity={shutter || !minShutterEffectPassed ? "50%" : "100%"}
                width={width}
                height={(width * 9) / 16}
              />
            )}
          </StyledBox>
          <CameraInputButton
            onClick={removeCapture}
            progress={progress}
            disabled={!!progress || disabled}
          >
            {progress ? (
              "Uploading..."
            ) : (
              <StyledSpan>
                <Icon content={X} margin="0 xs 0 0" size="sm" /> Clear photo
              </StyledSpan>
            )}
          </CameraInputButton>
        </>
      ) : (
        <WebcamComponent
          handleCapture={handleCapture}
          width={width}
          disabled={disabled}
          clearPhotoInProgress={clearPhotoInProgress}
          setClearPhotoInProgress={setClearPhotoInProgress}
          facingMode={facingMode}
          setFacingMode={handleSetFacingMode}
          testOverride={testOverride}
        />
      )}
    </StyledCameraInput>
  )
}

export default memo(CameraInput)
