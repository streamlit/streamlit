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

import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { render } from "@streamlit/lib"

import DialogErrorMessage, {
  DialogErrorMessageProps,
} from "./DialogErrorMessage"

function renderDialogErrorMessage(
  props: DialogErrorMessageProps
): ReturnType<typeof render> {
  return render(<DialogErrorMessage {...props} />)
}

describe("DialogErrorMessage", () => {
  it("renders plain text message", () => {
    renderDialogErrorMessage({
      message: "Simple error message",
    })

    expect(screen.getByText("Simple error message")).toBeVisible()
  })

  it("renders multiline message", () => {
    const multilineMessage = `Line 1
Line 2
Line 3`

    renderDialogErrorMessage({
      message: multilineMessage,
    })

    // Check for individual lines
    expect(screen.getByText("Line 1", { exact: false })).toBeVisible()
    expect(screen.getByText("Line 2", { exact: false })).toBeVisible()
    expect(screen.getByText("Line 3", { exact: false })).toBeVisible()
  })

  it("renders message without code block when codeBlock is not passed", () => {
    renderDialogErrorMessage({
      message: "Error occurred",
      codeBlock: undefined,
    })

    expect(screen.getByText("Error occurred")).toBeVisible()
    expect(screen.queryByTestId("stErrorCodeBlock")).not.toBeInTheDocument()
  })

  it("renders message with code block when codeBlock is provided", () => {
    renderDialogErrorMessage({
      message: "Connection failed with status 500, and response:",
      codeBlock: '{"error": "Internal Server Error"}',
    })

    expect(
      screen.getByText("Connection failed with status 500, and response:")
    ).toBeVisible()
    expect(screen.getByTestId("stErrorCodeBlock")).toBeVisible()
    expect(
      screen.getByText('{"error": "Internal Server Error"}')
    ).toBeVisible()
  })

  it("renders formatted JSON in code block", () => {
    const jsonCode = JSON.stringify(
      {
        error: "Internal Server Error",
        message: "Something went wrong",
        code: 500,
      },
      null,
      2
    )

    renderDialogErrorMessage({
      message: "Server error:",
      codeBlock: jsonCode,
    })

    expect(screen.getByText("Server error:")).toBeVisible()
    expect(screen.getByTestId("stErrorCodeBlock")).toBeVisible()
    // Check for parts of the JSON
    expect(
      screen.getByText(/"error": "Internal Server Error"/, { exact: false })
    ).toBeVisible()
  })

  it("renders command in code block for localhost connection error", () => {
    renderDialogErrorMessage({
      message:
        "Is Streamlit still running? If you accidentally stopped Streamlit, just restart it in your terminal:",
      codeBlock: "streamlit run yourscript.py",
    })

    expect(screen.getByText(/Is Streamlit still running/)).toBeVisible()
    expect(screen.getByTestId("stErrorCodeBlock")).toBeVisible()
    expect(screen.getByText("streamlit run yourscript.py")).toBeVisible()
  })

  it("renders plain URLs as clickable links", () => {
    renderDialogErrorMessage({
      message:
        "Cannot connect to Streamlit (HTTP status: 403).\n\nIf you are trying to access a Streamlit app running on another server, this could be due to the app's CORS settings. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
    })

    // Check for key parts of the message
    expect(
      screen.getByText("Cannot connect to Streamlit (HTTP status: 403).", {
        exact: false,
      })
    ).toBeVisible()
    expect(screen.getByText(/CORS settings/)).toBeVisible()

    // Verify plain URL is clickable
    const link = screen.getByRole("link")
    expect(link).toBeVisible()
    expect(link).toHaveAttribute(
      "href",
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    expect(link).toHaveTextContent(
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"
    )
  })

  it("renders markdown links but not other markdown syntax", () => {
    renderDialogErrorMessage({
      message:
        "**Bold text** and *italic text* and [link](https://example.com)",
    })

    // Bold and italic are shown as literal text (not parsed)
    expect(screen.getByText(/\*\*Bold text\*\*/)).toBeVisible()
    expect(screen.getByText(/\*italic text\*/)).toBeVisible()

    // But markdown links ARE parsed and clickable
    const link = screen.getByRole("link", { name: "link" })
    expect(link).toBeVisible()
    expect(link).toHaveAttribute("href", "https://example.com")
  })

  it("renders CORS error with clickable markdown link", () => {
    renderDialogErrorMessage({
      message:
        "Cannot connect to Streamlit (HTTP status: 403).\n\nIf you are trying to access a Streamlit app running on another server, this could be due to the app's [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) settings.",
    })

    // Verify the CORS link is clickable
    const link = screen.getByRole("link", { name: "CORS" })
    expect(link).toBeVisible()
    expect(link).toHaveAttribute(
      "href",
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders message with special characters", () => {
    renderDialogErrorMessage({
      message:
        'Error: <script>alert("XSS")</script> & "quotes" \'and\' symbols',
    })

    expect(
      screen.getByText(
        'Error: <script>alert("XSS")</script> & "quotes" \'and\' symbols'
      )
    ).toBeVisible()
  })

  it("renders connection timeout error", () => {
    renderDialogErrorMessage({
      message: "Connection timed out.",
    })

    expect(screen.getByText("Connection timed out.")).toBeVisible()
    expect(screen.queryByTestId("stErrorCodeBlock")).not.toBeInTheDocument()
  })

  it("renders server not responding error", () => {
    renderDialogErrorMessage({
      message:
        "Streamlit server is not responding. Are you connected to the internet?",
    })

    expect(
      screen.getByText(
        "Streamlit server is not responding. Are you connected to the internet?"
      )
    ).toBeVisible()
    expect(screen.queryByTestId("stErrorCodeBlock")).not.toBeInTheDocument()
  })

  it("renders page not found error", () => {
    renderDialogErrorMessage({
      message:
        "You have requested page /nonexistent, but no corresponding file was found in the app's pages/ directory. Running the app's main page.",
    })

    expect(
      screen.getByText(
        "You have requested page /nonexistent, but no corresponding file was found in the app's pages/ directory. Running the app's main page."
      )
    ).toBeVisible()
    expect(screen.queryByTestId("stErrorCodeBlock")).not.toBeInTheDocument()
  })

  it("renders bad message format error", () => {
    renderDialogErrorMessage({
      message: "Invalid JSON format in message",
    })

    expect(screen.getByText("Invalid JSON format in message")).toBeVisible()
    expect(screen.queryByTestId("stErrorCodeBlock")).not.toBeInTheDocument()
  })

  it("code block component has copy functionality", () => {
    renderDialogErrorMessage({
      message: "Error:",
      codeBlock: "some code to copy",
    })

    const codeBlock = screen.getByTestId("stErrorCodeBlock")
    expect(codeBlock).toBeVisible()

    // The StreamlitErrorCodeBlock should contain the text
    expect(codeBlock).toHaveTextContent("some code to copy")
  })

  it("renders very long message text", () => {
    renderDialogErrorMessage({
      message:
        "This is a very long error message that might wrap across multiple lines in the dialog. ".repeat(
          10
        ),
    })

    // Check that the message appears (checking for a substring)
    expect(
      screen.getByText(
        "This is a very long error message that might wrap across multiple lines in the dialog.",
        { exact: false }
      )
    ).toBeVisible()
  })

  it("renders very long code block", () => {
    const longCode = JSON.stringify(
      {
        error: "Long error",
        stack: "Line 1\n".repeat(50),
        data: Array(100)
          .fill(0)
          .map((_, i) => i),
      },
      null,
      2
    )

    renderDialogErrorMessage({
      message: "Stack trace:",
      codeBlock: longCode,
    })

    expect(screen.getByText("Stack trace:")).toBeVisible()
    expect(screen.getByTestId("stErrorCodeBlock")).toBeVisible()
    // Check for part of the code
    expect(
      screen.getByText(/"error": "Long error"/, { exact: false })
    ).toBeVisible()
  })
})
