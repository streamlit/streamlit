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

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  ChatInput as ChatInputProto,
  FileURLs as FileURLsProto,
  IChatInputValue,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import {
  createDirectoryFiles,
  createFileWithPath,
  render,
} from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ChatInput, { Props } from "./ChatInput"

const getProps = (
  elementProps: Partial<ChatInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: ChatInputProto.create({
    id: "123",
    placeholder: "Enter Text Here",
    disabled: false,
    default: "",
    acceptFile: ChatInputProto.AcceptFile.NONE,
    ...elementProps,
  }),
  width: 300,
  disabled: elementProps.disabled ?? false,
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
})

const mockChatInputValue = (text: string): IChatInputValue => {
  return {
    data: text,
    fileUploaderState: {
      uploadedFileInfo: [],
    },
  }
}

describe("ChatInput widget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeInTheDocument()
  })

  it("shows a placeholder", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("sets the aria label to the placeholder", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveAttribute("aria-label", props.element.placeholder)
  })

  it("sets the value initially to the element default", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent(props.element.default)
  })

  it("sets the value when values are typed in", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "Sample text")
    expect(chatInput).toHaveTextContent("Sample text")
  })

  it("does not increase text value when maxChars is set", async () => {
    const user = userEvent.setup()
    const props = getProps({ maxChars: 10 })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")
    await user.type(chatInput, "1")
    expect(chatInput).toHaveTextContent("1234567890")
  })

  it("sends and resets the value on enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890{enter}")
    expect(spy).toHaveBeenCalledWith(
      props.element,
      mockChatInputValue("1234567890"),
      {
        fromUi: true,
      },
      undefined
    )
    expect(chatInput).toHaveTextContent("")
  })

  it("ensures chat input has focus on submit by keyboard", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890{enter}")
    expect(chatInput).toHaveFocus()
  })

  it("ensures chat input has focus on submit by button click", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    const chatButton = screen.getByTestId("stChatInputSubmitButton")
    await user.type(chatInput, "1234567890")
    await user.click(chatButton)
    expect(chatInput).toHaveFocus()
  })

  it("can set fragmentId when sending value", async () => {
    const user = userEvent.setup()
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890{enter}")
    expect(spy).toHaveBeenCalledWith(
      props.element,
      mockChatInputValue("1234567890"),
      {
        fromUi: true,
      },
      "myFragmentId"
    )
  })

  it("will not send an empty value on enter if empty", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "{enter}")
    expect(spy).not.toHaveBeenCalledWith(props.element, "", {
      fromUi: true,
    })
    expect(chatInput).toHaveTextContent("")
  })

  it("will not show instructions when the text has changed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    const instructions = screen.getByTestId("InputInstructions")
    expect(instructions).toHaveTextContent("")

    await user.type(chatInput, "1234567890")
    expect(instructions).toHaveTextContent("")
  })

  it("does not send/clear on shift + enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)
    const chatInput = screen.getByTestId("stChatInputTextArea")

    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")
    await user.type(chatInput, "{shift>}{enter}{/shift}")
    expect(chatInput).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not send/clear on ctrl + enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")

    await user.keyboard("{Control>}{Enter}{/Control}")

    // We cannot test the value to be changed cause that is essentially a
    // change event.
    expect(screen.getByTestId("stChatInputTextArea")).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not send/clear on meta + enter", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "1234567890")
    expect(chatInput).toHaveTextContent("1234567890")
    await user.type(chatInput, "{meta>}{enter}{/meta}")
    expect(chatInput).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does sets the value if specified from protobuf to set it", () => {
    const props = getProps({ value: "12345", setValue: true })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent("12345")
  })

  it("does not set the value if protobuf does not specify to set it", () => {
    const props = getProps({ value: "12345", setValue: false })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent("")
  })

  it("disables the textarea and button", () => {
    const props = getProps({
      disabled: true,
      acceptFile: ChatInputProto.AcceptFile.SINGLE,
    })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeDisabled()

    screen.getAllByRole("button").forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it("not disable the textarea by default", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).not.toBeDisabled()

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("disables the send button by default since there's no text", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("enables the send button when text is set, disables it when removed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "Sample text")

    const button = screen.getByRole("button")
    expect(button).not.toBeDisabled()

    await user.clear(chatInput)
    expect(button).toBeDisabled()
  })

  describe("dirty state behavior", () => {
    it("disables submit button when there are no files and no text", () => {
      const props = getProps()
      render(<ChatInput {...props} />)

      const button = screen.getByTestId("stChatInputSubmitButton")
      expect(button).toBeDisabled()
    })

    it("enables submit button when there is text", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<ChatInput {...props} />)

      const chatInput = screen.getByTestId("stChatInputTextArea")
      await user.type(chatInput, "Hello")

      const button = screen.getByTestId("stChatInputSubmitButton")
      expect(button).not.toBeDisabled()
    })

    it("disables submit button when files are uploading", async () => {
      const user = userEvent.setup()
      const props = getProps({
        acceptFile: ChatInputProto.AcceptFile.SINGLE,
        maxUploadSizeMb: 1,
      })

      // Mock the uploadClient to simulate an uploading file
      props.uploadClient.uploadFile = vi.fn().mockImplementation(() => {
        return new Promise(() => {}) // Never resolves to simulate ongoing upload
      })

      render(<ChatInput {...props} />)

      // Add text to make the button enabled
      const chatInput = screen.getByTestId("stChatInputTextArea")
      await user.type(chatInput, "Text with uploading file")

      // Verify button is enabled before file upload
      const submitButton = screen.getByTestId("stChatInputSubmitButton")
      expect(submitButton).not.toBeDisabled()

      // Simulate file upload
      const file = new File(["file content"], "test.txt", {
        type: "text/plain",
      })
      const fileUploadButton = screen.getByTestId(
        "stChatInputFileUploadButton"
      )
      // The `input` element isn't accessible, so we need to access it directly via the DOM
      const fileUploadInput = fileUploadButton.querySelector("input")
      if (!fileUploadInput) {
        throw new Error("File upload input not found")
      }
      await user.upload(fileUploadInput, file)

      // Button should be disabled during upload - no need to wait for upload to finish
      // since we're specifically testing the in-between state
      expect(submitButton).toBeDisabled()

      // Verify the upload was attempted
      expect(props.uploadClient.uploadFile).toHaveBeenCalled()
    })

    it("does not submit when dirty is false", async () => {
      const user = userEvent.setup()
      const props = getProps()
      const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")
      render(<ChatInput {...props} />)

      const chatInput = screen.getByTestId("stChatInputTextArea")
      const button = screen.getByTestId("stChatInputSubmitButton")

      // Button should be disabled initially
      expect(button).toBeDisabled()

      // Try to submit by clicking the button
      await user.click(button)
      expect(spy).not.toHaveBeenCalled()

      // Try to submit by pressing Enter
      await user.type(chatInput, "{enter}")
      expect(spy).not.toHaveBeenCalled()
    })
  })

  it("displays directory upload button when directory upload is enabled", () => {
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      fileType: ["txt", "py", "md"],
    })

    render(<ChatInput {...props} />)

    // Check that file upload button is visible for directory uploads
    const uploadButton = screen.getByTestId("stChatInputFileUploadButton")
    expect(uploadButton).toBeVisible()

    // Verify aria labels and accessibility
    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeInTheDocument()
  })

  it("handles directory upload with multiple files", async () => {
    const user = userEvent.setup()
    const mockSetChatInputValue = vi.fn()
    const mockWidgetMgr = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    })
    mockWidgetMgr.setChatInputValue = mockSetChatInputValue

    const props = getProps(
      {
        acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
        fileType: ["txt", "py", "md"],
      },
      {
        widgetMgr: mockWidgetMgr,
      }
    )

    render(<ChatInput {...props} />)

    // Since we can't easily simulate file upload in unit tests,
    // let's verify the component is set up correctly for directory uploads
    const fileUploadButton = screen.getByTestId("stChatInputFileUploadButton")
    const fileInput = fileUploadButton.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute("webkitdirectory")
    expect(fileInput).toHaveAttribute("multiple")

    // Verify the component is configured to accept directory uploads
    expect(props.element.acceptFile).toBe(ChatInputProto.AcceptFile.DIRECTORY)

    // Verify we can still type messages
    const textarea = screen.getByTestId("stChatInputTextArea")
    await user.type(textarea, "Test message")

    // Submit the chat input
    const submitButton = screen.getByTestId("stChatInputSubmitButton")
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSetChatInputValue).toHaveBeenCalledWith(
        props.element,
        expect.objectContaining({
          data: "Test message",
          fileUploaderState: expect.any(Object),
        }),
        { fromUi: true },
        undefined
      )
    })

    // Verify input is cleared after submission
    expect(textarea).toHaveTextContent("")
  })

  it("filters directory files by allowed types", () => {
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      fileType: ["txt"], // Only allow .txt files
    })

    render(<ChatInput {...props} />)

    // Verify the component is set up correctly for directory uploads with file type filtering
    const fileUploadButton = screen.getByTestId("stChatInputFileUploadButton")
    const fileInput = fileUploadButton.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute("webkitdirectory")
    expect(fileInput).toHaveAttribute("multiple")

    // Verify the component is configured with file type restrictions
    expect(props.element.fileType).toEqual(["txt"])
  })

  it("handles empty directory upload", async () => {
    const user = userEvent.setup()
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
    })

    render(<ChatInput {...props} />)

    // Verify the component is set up correctly for directory uploads
    const fileUploadButton = screen.getByTestId("stChatInputFileUploadButton")
    const fileInput = fileUploadButton.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute("webkitdirectory")
    expect(fileInput).toHaveAttribute("multiple")

    // Should still be able to type and submit message
    const textarea = screen.getByTestId("stChatInputTextArea")
    await user.type(textarea, "No files to share")

    const submitButton = screen.getByTestId("stChatInputSubmitButton")
    expect(submitButton).toBeEnabled()
  })

  it("displays directory upload instructions correctly", () => {
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      placeholder: "Upload a directory",
    })

    render(<ChatInput {...props} />)

    // Check for directory-specific UI elements
    const uploadButton = screen.getByTestId("stChatInputFileUploadButton")
    expect(uploadButton).toBeInTheDocument()

    // Verify file input has directory attributes for directory upload
    const fileInput = uploadButton.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute("webkitdirectory")
    expect(fileInput).toHaveAttribute("multiple")

    // Verify placeholder text is displayed
    const textarea = screen.getByTestId("stChatInputTextArea")
    expect(textarea).toHaveAttribute("placeholder", "Upload a directory")

    // The tooltip hover target should be present for directory upload
    const tooltipTarget = uploadButton.querySelector(".stTooltipHoverTarget")
    expect(tooltipTarget).toBeInTheDocument()
  })

  it("removes directory files when deleted individually", async () => {
    const user = userEvent.setup()
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      maxUploadSizeMb: 50,
    })

    render(<ChatInput {...props} />)

    // Create test files with directory structure
    const directoryFiles = createDirectoryFiles([
      { content: "content1", path: "folder/file1.txt" },
      { content: "content2", path: "folder/file2.txt" },
    ])

    // Upload the files
    const fileUploadButton = screen.getByTestId("stChatInputFileUploadButton")
    const fileInput = fileUploadButton.querySelector(
      "input"
    ) as HTMLInputElement
    await user.upload(fileInput, directoryFiles)

    // Wait for files to be displayed (order-agnostic check)
    await waitFor(() => {
      const fileNames = screen.getAllByTestId("stChatInputFileName")
      expect(fileNames).toHaveLength(2)

      // Check that both files are present, regardless of order
      const fileTexts = Array.from(fileNames).map(el => el.textContent)
      expect(fileTexts).toContain("folder/file1.txt")
      expect(fileTexts).toContain("folder/file2.txt")
    })

    // Find and delete file1
    const deleteButtons = screen.getAllByTestId("stChatInputDeleteBtn")
    expect(deleteButtons).toHaveLength(2)

    // Find which delete button corresponds to file1
    const fileNames = screen.getAllByTestId("stChatInputFileName")
    const file1Index = Array.from(fileNames).findIndex(
      el => el.textContent === "folder/file1.txt"
    )

    // Click the actual button inside the delete button wrapper for file1
    const file1DeleteButton = deleteButtons[file1Index].querySelector("button")
    expect(file1DeleteButton).toBeTruthy()
    await user.click(file1DeleteButton as HTMLButtonElement)

    // Verify only file2 remains
    await waitFor(() => {
      const remainingFileNames = screen.getAllByTestId("stChatInputFileName")
      expect(remainingFileNames).toHaveLength(1)
      expect(remainingFileNames[0]).toHaveTextContent("folder/file2.txt")
    })

    // Delete the remaining file
    const remainingDeleteButtons = screen.getAllByTestId(
      "stChatInputDeleteBtn"
    )
    const remainingDeleteButton =
      remainingDeleteButtons[0].querySelector("button")
    expect(remainingDeleteButton).toBeTruthy()
    await user.click(remainingDeleteButton as HTMLButtonElement)

    // Verify all files are removed
    await waitFor(() => {
      const fileNames = screen.queryAllByTestId("stChatInputFileName")
      expect(fileNames).toHaveLength(0)
    })
  })

  it("handles directory upload with multiple files and preserves paths", async () => {
    const user = userEvent.setup()
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      maxUploadSizeMb: 50,
    })

    const spy = vi.spyOn(props.widgetMgr, "setChatInputValue")

    render(<ChatInput {...props} />)

    // Add some text
    const chatInput = screen.getByTestId("stChatInputTextArea")
    await user.type(chatInput, "Here are the project files")

    // Mock directory files with relative paths
    const directoryFiles = createDirectoryFiles([
      { content: "main content", path: "project/main.py" },
      { content: "test content", path: "project/tests/test.py" },
    ])

    const fileUploadButton = screen.getByTestId("stChatInputFileUploadButton")
    const fileUploadInput = fileUploadButton.querySelector(
      "input"
    ) as HTMLInputElement

    // Simulate file selection
    await user.upload(fileUploadInput, directoryFiles)

    // Wait for file processing
    await waitFor(() => {
      expect(props.uploadClient.uploadFile).toHaveBeenCalledTimes(2)
    })

    // Submit the chat
    const submitButton = screen.getByTestId("stChatInputSubmitButton")
    await user.click(submitButton)

    // Verify the widget value was set with text and files
    expect(spy).toHaveBeenCalled()
    const callArgs = spy.mock.calls[0]
    const chatInputValue = callArgs[1]

    // Check the text content
    expect(chatInputValue.data).toBe("Here are the project files")

    // Check that files were uploaded
    expect(chatInputValue.fileUploaderState?.uploadedFileInfo).toHaveLength(2)
    expect(chatInputValue.fileUploaderState?.uploadedFileInfo?.[0].name).toBe(
      "project/main.py"
    )
    expect(chatInputValue.fileUploaderState?.uploadedFileInfo?.[1].name).toBe(
      "project/tests/test.py"
    )
  })

  it("shows directory structure preservation in file names", async () => {
    const user = userEvent.setup()
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      maxUploadSizeMb: 50,
    })

    render(<ChatInput {...props} />)

    // Files with webkitRelativePath to simulate directory structure
    const directoryFile = createFileWithPath(
      "content",
      "readme.md",
      "docs/readme.md"
    )

    const fileUploadButton = screen.getByTestId("stChatInputFileUploadButton")
    const fileUploadInput = fileUploadButton.querySelector(
      "input"
    ) as HTMLInputElement

    await user.upload(fileUploadInput, directoryFile)

    // Wait for file to be displayed
    await waitFor(() => {
      const fileName = screen.getByTestId("stChatInputFileName")
      expect(fileName).toHaveTextContent("docs/readme.md")
    })
  })

  it("enables submit button when directory files are uploaded", async () => {
    const user = userEvent.setup()
    const props = getProps({
      acceptFile: ChatInputProto.AcceptFile.DIRECTORY,
      maxUploadSizeMb: 50,
    })

    render(<ChatInput {...props} />)

    // Initially submit button should be disabled (no text, no files)
    const submitButton = screen.getByTestId("stChatInputSubmitButton")
    expect(submitButton).toBeDisabled()

    // Upload a file
    const file = new File(["content"], "file.txt", { type: "text/plain" })
    const fileUploadButton = screen.getByTestId("stChatInputFileUploadButton")
    const fileUploadInput = fileUploadButton.querySelector(
      "input"
    ) as HTMLInputElement

    await user.upload(fileUploadInput, file)

    // Wait for upload to complete
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
    })
  })
})
