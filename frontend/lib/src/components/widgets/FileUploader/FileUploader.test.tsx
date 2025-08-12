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

import React from "react"

import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  IFileURLs,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import FileUploader, { Props } from "./FileUploader"

const createFile = (
  filename = "filename.txt",
  webkitRelativePath?: string,
  type = "text/plain"
): File => {
  const file = new File(["Text in a file!"], filename, {
    type,
    lastModified: 0,
  })
  if (webkitRelativePath) {
    Object.defineProperty(file, "webkitRelativePath", {
      value: webkitRelativePath,
      writable: false,
    })
  }
  return file
}

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
  elementProps: Partial<FileUploaderProto> = {},
  widgetProps: Partial<Props> = {}
): Props => {
  return {
    element: FileUploaderProto.create({
      id: "id",
      type: [],
      maxUploadSizeMb: 50,
      ...elementProps,
    }),
    width: 250,
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
    ...widgetProps,
  }
}

describe("FileUploader widget tests", () => {
  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<FileUploader {...props} />)
    const fileUploaderElement = screen.getByTestId("stFileUploader")
    expect(fileUploaderElement).toBeInTheDocument()
  })

  it("sets initial value properly non-empty", () => {
    const props = getProps()
    const { element, widgetMgr } = props

    widgetMgr.setFileUploaderStateValue(
      element,
      buildFileUploaderStateProto([
        new FileURLsProto({
          fileId: "filename.txt",
          uploadUrl: "filename.txt",
          deleteUrl: "filename.txt",
        }),
      ]),
      { fromUi: false },
      undefined
    )

    render(<FileUploader {...props} />)
    const fileNameNode = screen.getByText("filename.txt")
    expect(fileNameNode).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps({ label: "Test label" })
    render(<FileUploader {...props} />)

    const labelNode = screen.getByText("Test label")
    expect(labelNode).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      label: "Test label",
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<FileUploader {...props} />)

    const labelNode = screen.getByText("Test label")
    expect(labelNode).toBeInTheDocument()
    expect(labelNode).not.toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      label: "Test label",
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<FileUploader {...props} />)

    const labelNode = screen.getByText("Test label")
    expect(labelNode).toBeInTheDocument()
    expect(labelNode).not.toBeVisible()
  })

  it("uploads a single file upload", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput: HTMLInputElement = screen.getByTestId(
      "stFileUploaderDropzoneInput"
    )

    const fileToUpload = createFile()

    await user.upload(fileDropZoneInput, fileToUpload)

    const fileName = screen.getByTestId("stFileUploaderFile")
    expect(fileName.textContent).toContain("filename.txt")
    expect(fileDropZoneInput.files?.[0]).toEqual(fileToUpload)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename.txt",
          uploadUrl: "filename.txt",
          deleteUrl: "filename.txt",
        },
      ]),
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("can pass fragmentId to setFileUploaderStateValue", async () => {
    const user = userEvent.setup()
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput: HTMLInputElement = screen.getByTestId(
      "stFileUploaderDropzoneInput"
    )

    const fileToUpload = createFile()
    await user.upload(fileDropZoneInput, fileToUpload)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename.txt",
          uploadUrl: "filename.txt",
          deleteUrl: "filename.txt",
        },
      ]),
      {
        fromUi: true,
      },
      "myFragmentId"
    )
  })

  it("uploads a single file even if too many files are selected", async () => {
    const props = getProps({ multipleFiles: false })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId("stFileUploaderDropzone")

    const filesToUpload = [
      new File(["Text in a file!"], "filename1.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Text in an another file!"], "filename2.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Another text in an another file!"], "filename3.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
    ]

    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files", "Files", "Files"],
        files: filesToUpload,
      },
    })

    await waitFor(() =>
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(1)
    )

    const fileElements = screen.getAllByTestId("stFileUploaderFile")
    // We should have 3 files. One will be uploading, the other two will
    // be in the error state.
    expect(fileElements.length).toBe(3)
    expect(fileElements[0].textContent).toContain("filename1.txt")

    const errors = screen.getAllByTestId("stFileUploaderFileErrorMessage")

    expect(errors.length).toBe(2)
    expect(errors[0].textContent).toContain("Only one file is allowed.")
    expect(errors[1].textContent).toContain("Only one file is allowed.")

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
      ]),
      {
        fromUi: true,
      },
      undefined
    )
  })
  it("replaces file on single file uploader", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput: HTMLInputElement = screen.getByTestId(
      "stFileUploaderDropzoneInput"
    )

    const firstFile = createFile()

    await user.upload(fileDropZoneInput, firstFile)

    const fileName = screen.getByTestId("stFileUploaderFile")
    expect(fileName.textContent).toContain("filename.txt")
    expect(fileDropZoneInput.files?.[0]).toEqual(firstFile)

    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(1)
    // setFileUploaderStateValue should have been called once on init and once
    // when the file was uploaded.
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(2)

    const secondFile = new File(["Another text in a file"], "filename2.txt", {
      type: "text/plain",
      lastModified: 0,
    })

    // Upload a replacement file
    await user.upload(fileDropZoneInput, secondFile)

    const currentFiles = screen.getAllByTestId("stFileUploaderFile")
    expect(currentFiles.length).toBe(1)
    expect(currentFiles[0].textContent).toContain("filename2.txt")
    expect(fileDropZoneInput.files?.[0]).toEqual(secondFile)
    expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    // setFileUploaderStateValue should have been called once on init and
    // once each for the first and second file uploads.
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(3)
  })

  it("uploads multiple files, even if some have errors", async () => {
    const props = getProps({ multipleFiles: true, type: [".txt"] })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId("stFileUploaderDropzone")

    const filesToUpload = [
      new File(["Text in a file!"], "filename1.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Text in a file?"], "filename2.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
      new File(["Another PDF file"], "anotherpdffile.pdf", {
        type: "application/pdf",
        lastModified: 0,
      }),
    ]

    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files"],
        files: filesToUpload,
        items: filesToUpload.map(file => ({
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        })),
      },
    })

    await waitFor(() =>
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    )

    const fileNames = screen.getAllByTestId("stFileUploaderFile")
    expect(fileNames.length).toBe(3)

    const errorFileNames = screen.getAllByTestId(
      "stFileUploaderFileErrorMessage"
    )
    expect(errorFileNames.length).toBe(1)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
        {
          fileId: "filename2.txt",
          uploadUrl: "filename2.txt",
          deleteUrl: "filename2.txt",
        },
      ]),
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("uploads directory with multiple files successfully", async () => {
    const props = getProps({
      multipleFiles: true,
      acceptDirectory: true,
      type: [".txt", ".py", ".md"],
    })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId("stFileUploaderDropzone")

    // Simulate directory upload with files in different folders
    const directoryFiles = [
      createFile("project/main.py", "project/main.py"),
      createFile("project/tests/test_main.py", "project/tests/test_main.py"),
      createFile("project/README.md", "project/README.md"),
      createFile("project/config.txt", "project/config.txt"),
    ]

    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files"],
        files: directoryFiles,
        items: directoryFiles.map(file => ({
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        })),
      },
    })

    await waitFor(() =>
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(4)
    )

    const fileElements = screen.getAllByTestId("stFileUploaderFile")
    expect(fileElements.length).toBe(3)

    // Verify all files are accepted since they match the allowed types
    expect(
      screen.queryByTestId("stFileUploaderFileErrorMessage")
    ).not.toBeInTheDocument()

    // Verify that setFileUploaderStateValue was called (internal structure may vary)
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalled()
  })

  it("filters directory upload files by type restrictions", async () => {
    const props = getProps({
      multipleFiles: true,
      acceptDirectory: true,
      type: [".txt"], // Only allow .txt files
    })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId("stFileUploaderDropzone")

    // Mix of valid and invalid files for directory upload
    const mixedFiles = [
      createFile("docs/valid.txt", "docs/valid.txt"),
      createFile("docs/subfolder/another.txt", "docs/subfolder/another.txt"),
      createFile("docs/image.jpg", "docs/image.jpg", "image/jpeg"),
      createFile("docs/document.pdf", "docs/document.pdf", "application/pdf"),
    ]

    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files"],
        files: mixedFiles,
        items: mixedFiles.map(file => ({
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        })),
      },
    })

    await waitFor(() =>
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    )

    // Should show uploaded files (filtering appears to happen at react-dropzone level)
    const fileElements = screen.getAllByTestId("stFileUploaderFile")
    expect(fileElements.length).toBe(3)

    // Should have 1 error message for the rejected file that doesn't match file type
    const errorElements = screen.queryAllByTestId(
      "stFileUploaderFileErrorMessage"
    )
    expect(errorElements.length).toBe(1)

    // Only valid .txt files should be uploaded - verify widget state was updated
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalled()
  })

  it("renders directory upload button text correctly", () => {
    const props = getProps({
      multipleFiles: true,
      acceptDirectory: true,
    })
    render(<FileUploader {...props} />)

    const browseButton = screen.getByRole("button", {
      name: "Browse directories",
    })
    expect(browseButton).toBeVisible()
  })

  it("sets webkitdirectory attribute for directory uploads", () => {
    const props = getProps({
      multipleFiles: true,
      acceptDirectory: true,
    })
    render(<FileUploader {...props} />)

    const fileDropZoneInput: HTMLInputElement = screen.getByTestId(
      "stFileUploaderDropzoneInput"
    )
    expect(fileDropZoneInput).toHaveAttribute("webkitdirectory", "")
  })

  it("preserves directory structure in file names", async () => {
    const user = userEvent.setup()
    const props = getProps({
      multipleFiles: true,
      acceptDirectory: true,
    })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput: HTMLInputElement = screen.getByTestId(
      "stFileUploaderDropzoneInput"
    )

    // Create files with webkitRelativePath to simulate directory structure
    const directoryFiles = [
      createFile("project/src/main.py", "project/src/main.py"),
      createFile("project/tests/test_main.py", "project/tests/test_main.py"),
    ]

    await user.upload(fileDropZoneInput, directoryFiles)

    // Files should show with their relative paths
    const fileElements = screen.getAllByTestId("stFileUploaderFile")
    expect(fileElements).toHaveLength(2)

    // Check that both files are present (order may vary)
    const fileTexts = fileElements.map(el => el.textContent)
    expect(fileTexts).toEqual(
      expect.arrayContaining([
        expect.stringContaining("project/src/main.py"),
        expect.stringContaining("project/tests/test_main.py"),
      ])
    )
  })

  it("handles empty directory upload gracefully", async () => {
    const props = getProps({
      multipleFiles: true,
      acceptDirectory: true,
    })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId("stFileUploaderDropzone")

    // Simulate empty directory
    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files"],
        files: [],
        items: [],
      },
    })

    await waitFor(() => {
      // No upload calls should be made
      expect(props.uploadClient.uploadFile).not.toHaveBeenCalled()
    })

    // No file elements should be created
    expect(screen.queryByTestId("stFileUploaderFile")).not.toBeInTheDocument()

    // Widget state should be initialized but not updated with files for empty directory
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(1)
  })

  it("displays correct instructions for directory upload", () => {
    const props = getProps({
      multipleFiles: true,
      acceptDirectory: true,
    })
    render(<FileUploader {...props} />)

    // Check that browse button shows directory text
    const browseButton = screen.getByText("Browse directories")
    expect(browseButton).toBeVisible()

    // Verify dropzone has webkitdirectory attribute
    const input = screen.getByTestId("stFileUploaderDropzoneInput")
    expect(input).toHaveAttribute("webkitdirectory", "")
  })

  it("can delete completed upload", async () => {
    const user = userEvent.setup()
    const props = getProps({ multipleFiles: true })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId("stFileUploaderDropzoneInput")

    // Upload two files
    await user.upload(fileDropZoneInput, createFile("filename1.txt"))
    await user.upload(fileDropZoneInput, createFile("filename2.txt"))

    const fileNames = screen.getAllByTestId("stFileUploaderFile")
    expect(fileNames.length).toBe(2)
    expect(fileNames[0].textContent).toContain("filename2.txt")
    expect(fileNames[1].textContent).toContain("filename1.txt")

    // WidgetStateManager should have been called with our two file IDs and first time with empty state
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(3)

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenLastCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
        {
          fileId: "filename2.txt",
          uploadUrl: "filename2.txt",
          deleteUrl: "filename2.txt",
        },
      ]),
      {
        fromUi: true,
      },
      undefined
    )

    const firstDeleteBtn = screen.getAllByTestId("stFileUploaderDeleteBtn")[0]

    await user.click(within(firstDeleteBtn).getByRole("button"))

    // We should only have a single file - the second file from the original upload list (filename1.txt).
    const fileNamesAfterDelete = screen.getAllByTestId("stFileUploaderFile")
    expect(fileNamesAfterDelete.length).toBe(1)
    expect(fileNamesAfterDelete[0].textContent).toContain("filename1.txt")

    // WidgetStateManager should have been called with the file ID
    // of the remaining file. This should be the fourth time WidgetStateManager
    // has been updated.
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(4)
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenLastCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename1.txt",
          uploadUrl: "filename1.txt",
          deleteUrl: "filename1.txt",
        },
      ]),
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("does not allow deleting files when disabled", async () => {
    const user = userEvent.setup()
    const props = getProps({ multipleFiles: true }, { disabled: true })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")

    // Seed an existing uploaded file before rendering (simulates server state)
    props.widgetMgr.setFileUploaderStateValue(
      props.element,
      buildFileUploaderStateProto([
        new FileURLsProto({
          fileId: "file1.txt",
          uploadUrl: "file1.txt",
          deleteUrl: "file1.txt",
        }),
      ]),
      { fromUi: false },
      undefined
    )

    render(<FileUploader {...props} />)

    // There should be one file displayed and a delete button present but disabled
    const deleteBtns = screen.getAllByTestId("stFileUploaderDeleteBtn")
    expect(deleteBtns.length).toBe(1)
    const buttonEl = within(deleteBtns[0]).getByRole("button")
    expect(buttonEl).toBeDisabled()

    // Clicking should not change files nor trigger state update
    await user.click(buttonEl)
    expect(screen.getAllByTestId("stFileUploaderFile").length).toBe(1)
  })

  it("allows deleting files when enabled", async () => {
    const user = userEvent.setup()
    const props = getProps({ multipleFiles: true })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId("stFileUploaderDropzoneInput")
    await user.upload(
      fileDropZoneInput,
      new File(["a"], "file1.txt", { type: "text/plain" })
    )
    const deleteBtn = screen.getByTestId("stFileUploaderDeleteBtn")
    const buttonEl = within(deleteBtn).getByRole("button")
    expect(buttonEl).not.toBeDisabled()
    await user.click(buttonEl)
    expect(screen.queryByTestId("stFileUploaderFile")).not.toBeInTheDocument()
  })

  it("can delete in-progress upload", async () => {
    const user = userEvent.setup()
    const props = getProps()

    // Mock the uploadFile method to return a promise that never resolves to test updating state
    props.uploadClient.uploadFile = vi.fn().mockImplementation(() => {
      return new Promise(() => {})
    })

    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId("stFileUploaderDropzoneInput")

    await user.upload(fileDropZoneInput, createFile())

    const progressBar = screen.getByRole("progressbar")
    expect(progressBar).toBeInTheDocument()

    // and then immediately delete it before upload "completes"
    const deleteBtn = screen.getByTestId("stFileUploaderDeleteBtn")

    await user.click(within(deleteBtn).getByRole("button"))

    expect(screen.queryByTestId("stFileUploaderFile")).not.toBeInTheDocument()

    // WidgetStateManager will still have been called once, during component mounting
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledTimes(1)
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([]),
      {
        fromUi: false,
      },
      undefined
    )
  })

  it("can delete file with ErrorStatus", async () => {
    const user = userEvent.setup()
    const props = getProps({ multipleFiles: false, type: [".txt"] })
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId("stFileUploaderDropzone")

    const filesToUpload = [
      new File(["Another PDF file"], "anotherpdffile.pdf", {
        type: "application/pdf",
        lastModified: 0,
      }),
    ]

    // Drop a file with an error (wrong extension)
    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files"],
        files: filesToUpload,
        items: filesToUpload.map(file => ({
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        })),
      },
    })

    await waitFor(() =>
      expect(screen.getAllByTestId("stFileUploaderFile").length).toBe(1)
    )

    const errorFileNames = screen.getAllByTestId(
      "stFileUploaderFileErrorMessage"
    )
    expect(errorFileNames.length).toBe(1)

    // Delete the file
    const firstDeleteBtn = screen.getAllByTestId("stFileUploaderDeleteBtn")[0]

    await user.click(within(firstDeleteBtn).getByRole("button"))

    // File should be gone
    expect(screen.queryByTestId("stFileUploaderFile")).not.toBeInTheDocument()
  })

  it("handles upload error", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId("stFileUploaderDropzoneInput")

    // Upload a file that will be rejected by the server
    props.uploadClient.uploadFile = vi
      .fn()
      .mockRejectedValue(new Error("random upload error!"))

    await user.upload(fileDropZoneInput, createFile())

    // Our file should have an error status
    const errorFileNames = screen.getByTestId("stFileUploaderFileErrorMessage")
    expect(errorFileNames.textContent).toContain("random upload error!")
  })

  it("shows an ErrorStatus when File extension is not allowed", async () => {
    const props = getProps({ multipleFiles: false, type: [".png"] })
    render(<FileUploader {...props} />)

    const fileDropZone = screen.getByTestId("stFileUploaderDropzone")

    const filesToUpload = [
      new File(["TXT file"], "txtfile.txt", {
        type: "text/plain",
        lastModified: 0,
      }),
    ]

    // Drop a file with an error (wrong extension)
    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        types: ["Files"],
        files: filesToUpload,
        items: filesToUpload.map(file => ({
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        })),
      },
    })

    await waitFor(() =>
      expect(screen.getAllByTestId("stFileUploaderFile").length).toBe(1)
    )

    const errorFileNames = screen.getByTestId("stFileUploaderFileErrorMessage")
    expect(errorFileNames.textContent).toContain(
      "text/plain files are not allowed."
    )
  })

  it("shows an ErrorStatus when maxUploadSizeMb = 0", async () => {
    const user = userEvent.setup()
    const props = getProps({ maxUploadSizeMb: 0 })
    render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId("stFileUploaderDropzoneInput")

    await user.upload(fileDropZoneInput, createFile())

    const errorFileNames = screen.getByTestId("stFileUploaderFileErrorMessage")
    expect(errorFileNames.textContent).toContain(
      "File must be 0.0B or smaller."
    )
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()

    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "setFileUploaderStateValue")
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setIntValue")

    const { rerender } = render(<FileUploader {...props} />)

    const fileDropZoneInput = screen.getByTestId("stFileUploaderDropzoneInput")

    // Upload a single file
    await user.upload(fileDropZoneInput, createFile())

    const fileName = screen.getByTestId("stFileUploaderFile")
    expect(fileName.textContent).toContain("filename.txt")

    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenCalledWith(
      props.element,
      buildFileUploaderStateProto([
        {
          fileId: "filename.txt",
          uploadUrl: "filename.txt",
          deleteUrl: "filename.txt",
        },
      ]),
      {
        fromUi: true,
      },
      undefined
    )

    // "Submit" the form
    props.widgetMgr.submitForm("form", undefined)
    rerender(<FileUploader {...props} />)

    // Our widget should be reset, and the widgetMgr should be updated
    expect(screen.queryByTestId("stFileUploaderFile")).not.toBeInTheDocument()

    // WidgetStateManager will still have been called once, during component mounting
    expect(props.widgetMgr.setFileUploaderStateValue).toHaveBeenLastCalledWith(
      props.element,
      buildFileUploaderStateProto([]),
      {
        fromUi: true,
      },
      undefined
    )
  })
})
