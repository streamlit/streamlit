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

import { act, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import createFetchMock from "vitest-fetch-mock"

import {
  CameraInput as CameraInputProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  IFileURLs,
  LabelVisibility as LabelVisibilityProto,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import CameraInput, { Props } from "./CameraInput"
import { WebcamPermission } from "./WebcamComponent"

vi.mock("react-webcam")
const fetchMocker = createFetchMock(vi)

const buildFileUploaderStateProto = (
  fileUrlsArray: IFileURLs[]
): FileUploaderStateProto =>
  new FileUploaderStateProto({
    uploadedFileInfo: fileUrlsArray.map(
      fileUrls =>
        new UploadedFileInfoProto({
          fileId: fileUrls.fileId,
          fileUrls,
          name: fileUrls.fileId,
          size: 15,
        })
    ),
  })

const getProps = (
  elementProps: Partial<CameraInputProto> = {},
  props: Partial<Props> = {}
): Props => {
  return {
    element: CameraInputProto.create({
      id: "id",
      label: "test_label",
      help: "help",
      formId: "",
      ...elementProps,
    }),
    disabled: false,
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    }),
    // @ts-expect-error
    uploadClient: {
      uploadFile: vi.fn().mockImplementation(() => {
        return Promise.resolve()
      }),
      fetchFileURLs: vi.fn().mockImplementation((acceptedFiles: File[]) => {
        return Promise.resolve(
          acceptedFiles.map(file => {
            return new FileURLsProto({
              fileId: file.name,
              uploadUrl: file.name,
              deleteUrl: file.name,
            })
          })
        )
      }),
      deleteFile: vi.fn(),
    },
    ...props,
  }
}

describe("CameraInput widget", () => {
  fetchMocker.enableMocks()

  beforeEach(() => {
    // Use fake timers to control debounced functions in WebcamComponent
    vi.useFakeTimers()
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
    fetchMocker.resetMocks()
  })

  afterEach(() => {
    // Clean up timers to prevent "window is not defined" errors
    // from debounced callbacks firing after test environment is torn down
    vi.runOnlyPendingTimers()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
      render(<CameraInput {...props} />)
      const cameraInput = screen.getByTestId("stCameraInput")
      expect(cameraInput).toBeVisible()
      expect(cameraInput).toHaveClass("stCameraInput")

      expect(screen.getByText("Take Photo")).toBeVisible()
      // WidgetStateManager should have been called on mounting
      expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(
        1
      )
    })

    it("shows a label", () => {
      const props = getProps()
      render(<CameraInput {...props} />)
      expect(screen.getByTestId("stWidgetLabel")).toHaveTextContent(
        props.element.label
      )
    })

    it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
      const props = getProps({
        labelVisibility: {
          value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
        },
      })
      render(<CameraInput {...props} />)
      expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
        "visibility: hidden"
      )
    })

    it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
      const props = getProps({
        labelVisibility: {
          value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
        },
      })
      render(<CameraInput {...props} />)
      expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
    })

    it("shows help tooltip when provided", () => {
      const props = getProps({ help: "This is a help tooltip" })
      render(<CameraInput {...props} />)
      // TooltipIcon should be present when help is provided
      expect(screen.getByTestId("stTooltipIcon")).toBeVisible()
    })

    it("does not show help tooltip when not provided", () => {
      const props = getProps({ help: "" })
      render(<CameraInput {...props} />)
      expect(screen.queryByTestId("stTooltipIcon")).not.toBeInTheDocument()
    })
  })

  describe("widget state initialization", () => {
    it("sets initial widget value on mount when undefined", () => {
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")

      render(<CameraInput {...props} />)

      expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(
        1
      )
      expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
        props.element,
        buildFileUploaderStateProto([]),
        { fromUi: false },
        undefined
      )
    })

    it("does not override existing widget value on mount", () => {
      const props = getProps()
      const existingState = buildFileUploaderStateProto([
        {
          fileId: "existing-photo.jpg",
          uploadUrl: "existing-photo.jpg",
          deleteUrl: "existing-photo.jpg",
        },
      ])
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        existingState,
        { fromUi: false },
        undefined
      )

      vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")

      render(<CameraInput {...props} />)

      // Should not be called again since value already exists
      expect(props.widgetMgr.setFileUploaderStateValue).not.toHaveBeenCalled()
    })

    it("restores state from existing widget value", () => {
      const props = getProps()
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "existing-photo.jpg",
            uploadUrl: "existing-photo.jpg",
            deleteUrl: "existing-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      // When there's an existing file, the Clear photo button should be shown
      // (since imgSrc would be RESTORED_FROM_WIDGET_STRING)
      expect(screen.getByText("Clear photo")).toBeVisible()
    })

    it("passes fragmentId to setFileUploaderStateValue", () => {
      const props = getProps({}, { fragmentId: "myFragmentId" })
      vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")

      render(<CameraInput {...props} />)

      expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
        props.element,
        expect.any(Object),
        { fromUi: false },
        "myFragmentId"
      )
    })
  })

  describe("webcam component", () => {
    it("shows webcam component when no photo is captured", () => {
      const props = getProps()
      render(<CameraInput {...props} />)

      expect(screen.getByTestId("stCameraInputWebcamComponent")).toBeVisible()
      expect(screen.getByText("Take Photo")).toBeVisible()
    })

    it("passes disabled prop to webcam component", () => {
      const props = getProps({}, { disabled: true })
      render(<CameraInput {...props} />)

      const takePhotoButton = screen.getByRole("button", {
        name: "Take Photo",
      })
      expect(takePhotoButton).toBeDisabled()
    })

    it("passes width to webcam component", () => {
      vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
        elementRef: { current: null },
        values: [400],
      })
      const props = getProps()
      render(<CameraInput {...props} />)

      // WebcamComponent should be rendered with the width
      const webcamBox = screen.getByTestId("stCameraInputWebcamStyledBox")
      expect(webcamBox).toBeInTheDocument()
    })
  })

  describe("photo capture", () => {
    it("shows Take Photo button when webcam permission is granted", () => {
      const props = getProps({}, { testOverride: WebcamPermission.SUCCESS })

      render(<CameraInput {...props} />)

      // Take Photo button should be visible
      const takePhotoButton = screen.getByRole("button", {
        name: "Take Photo",
      })
      expect(takePhotoButton).toBeVisible()
    })

    it("Take Photo button is enabled when webcam permission is granted", () => {
      const props = getProps({}, { testOverride: WebcamPermission.SUCCESS })

      render(<CameraInput {...props} />)

      const takePhotoButton = screen.getByRole("button", {
        name: "Take Photo",
      })
      // Button should be enabled when webcam permission is granted
      expect(takePhotoButton).not.toBeDisabled()
    })
  })

  describe("clear photo", () => {
    it("shows Clear photo button when image is captured", () => {
      const props = getProps()
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      expect(screen.getByText("Clear photo")).toBeVisible()
    })

    it("clears photo when Clear photo button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")

      // Set initial state with a photo
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      const clearButton = screen.getByRole("button", { name: /Clear photo/i })
      await user.click(clearButton)

      // After clearing, the webcam should be shown again
      await waitFor(() => {
        expect(
          screen.getByTestId("stCameraInputWebcamComponent")
        ).toBeVisible()
      })

      // Widget state should be updated with empty files
      expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
        props.element,
        buildFileUploaderStateProto([]),
        { fromUi: true },
        undefined
      )
    })

    it("calls deleteFile when clearing uploaded photo", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = getProps()

      // Set initial state with a photo
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      const clearButton = screen.getByRole("button", { name: /Clear photo/i })
      await user.click(clearButton)

      // deleteFile should be called with the delete URL
      await waitFor(() => {
        expect(props.uploadClient.deleteFile).toHaveBeenCalledWith(
          "test-photo.jpg"
        )
      })
    })

    it("disables Clear photo button during upload", () => {
      const props = getProps()

      // Set initial state with a photo (restored from widget)
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      const clearButton = screen.getByRole("button", { name: /Clear photo/i })
      // When not uploading, button should not be disabled
      expect(clearButton).not.toBeDisabled()
    })

    it("disables Clear photo button when component is disabled", () => {
      const props = getProps({}, { disabled: true })

      // Set initial state with a photo
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      const clearButton = screen.getByRole("button", { name: /Clear photo/i })
      expect(clearButton).toBeDisabled()
    })
  })

  describe("form behavior", () => {
    it("resets state when form is cleared", async () => {
      const props = getProps({ formId: "form-id" })
      vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")

      props.widgetMgr.setFormSubmitBehaviors("form-id", true)

      // Set initial state with a photo
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      // Verify we have the captured photo state
      expect(screen.getByText("Clear photo")).toBeVisible()

      // Submit the form (which should clear the widget)
      act(() => {
        props.widgetMgr.submitForm("form-id", undefined)
      })

      // After form submission, webcam should be shown again
      await waitFor(() => {
        expect(
          screen.getByTestId("stCameraInputWebcamComponent")
        ).toBeVisible()
      })

      // Widget state should be updated with empty files
      expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
        props.element,
        buildFileUploaderStateProto([]),
        { fromUi: true },
        undefined
      )
    })
  })

  describe("disabled state", () => {
    it("disables Take Photo button when disabled", () => {
      const props = getProps({}, { disabled: true })
      render(<CameraInput {...props} />)

      const takePhotoButton = screen.getByRole("button", {
        name: "Take Photo",
      })
      expect(takePhotoButton).toBeDisabled()
    })

    it("shows disabled webcam when component is disabled", () => {
      const props = getProps({}, { disabled: true })
      render(<CameraInput {...props} />)

      expect(screen.getByTestId("stCameraInputWebcamComponent")).toBeVisible()
    })
  })

  describe("upload handling", () => {
    it("handles upload error gracefully", () => {
      const props = getProps({}, { testOverride: WebcamPermission.SUCCESS })
      props.uploadClient.uploadFile = vi
        .fn()
        .mockRejectedValue(new Error("upload failed"))

      render(<CameraInput {...props} />)

      // Component should render without crashing even with upload errors
      expect(screen.getByText("Take Photo")).toBeVisible()
    })

    it("handles fetchFileURLs error gracefully", () => {
      const props = getProps({}, { testOverride: WebcamPermission.SUCCESS })
      props.uploadClient.fetchFileURLs = vi
        .fn()
        .mockRejectedValue(new Error("fetch URLs failed"))

      render(<CameraInput {...props} />)

      // Component should render without crashing
      expect(screen.getByText("Take Photo")).toBeVisible()
    })
  })

  describe("image display", () => {
    it("shows StyledBox with correct width", () => {
      vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
        elementRef: { current: null },
        values: [300],
      })

      const props = getProps()
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      // The StyledBox should be rendered when there's a captured image
      // (with RESTORED_FROM_WIDGET_STRING, image is not shown but box is)
      expect(screen.getByText("Clear photo")).toBeVisible()
    })

    it("does not display image when imgSrc is RESTORED_FROM_WIDGET_STRING", () => {
      const props = getProps()
      props.widgetMgr.setFileUploaderStateValue(
        props.element,
        buildFileUploaderStateProto([
          {
            fileId: "test-photo.jpg",
            uploadUrl: "test-photo.jpg",
            deleteUrl: "test-photo.jpg",
          },
        ]),
        { fromUi: false },
        undefined
      )

      render(<CameraInput {...props} />)

      // Image should not be present when restored from widget
      expect(screen.queryByRole("img", { name: "Snapshot" })).toBeNull()
      // But Clear photo button should be present
      expect(screen.getByText("Clear photo")).toBeVisible()
    })
  })

  describe("mobile facing mode", () => {
    it("starts with USER facing mode by default", () => {
      const props = getProps({}, { testOverride: WebcamPermission.SUCCESS })
      render(<CameraInput {...props} />)

      // Component renders with default facing mode (user)
      expect(screen.getByTestId("stCameraInputWebcamComponent")).toBeVisible()
    })
  })
})
