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

import { screen } from "@testing-library/react"

import { Alert as AlertProto } from "@streamlit/protobuf"

import { Kind } from "~lib/components/shared/AlertContainer/AlertContainer"
import { render } from "~lib/test_util"

import AlertElement, { AlertElementProps } from "./AlertElement"
import { getAlertElementKind } from "./utils"

const getProps = (
  elementProps: Partial<AlertElementProps> = {}
): AlertElementProps => ({
  body: "Something happened!",
  kind: Kind.INFO,
  ...elementProps,
})

describe("Alert element", () => {
  it("renders an ERROR box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.ERROR),
      body: "#what in the world?",
    })
    render(<AlertElement {...props} />)
    const alertElement = screen.getByTestId("stAlert")
    expect(alertElement).toBeInTheDocument()
    expect(alertElement).toHaveClass("stAlert")

    expect(screen.getByTestId("stAlertContentError")).toBeInTheDocument()
    expect(screen.queryByTestId("stAlertDynamicIcon")).not.toBeInTheDocument()
    expect(screen.getByText("#what in the world?")).toBeInTheDocument()
  })

  it("renders a WARNING box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.WARNING),
      body: "test",
    })
    render(<AlertElement {...props} />)
    expect(screen.getByTestId("stAlert")).toBeInTheDocument()
    expect(screen.getByTestId("stAlertContentWarning")).toBeInTheDocument()
    expect(screen.queryByTestId("stAlertDynamicIcon")).not.toBeInTheDocument()
    expect(screen.getByText("test")).toBeInTheDocument()
  })

  it("renders a SUCCESS box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.SUCCESS),
      body: "But our princess was in another castle!",
    })
    render(<AlertElement {...props} />)
    expect(screen.getByTestId("stAlert")).toBeInTheDocument()
    expect(screen.getByTestId("stAlertContentSuccess")).toBeInTheDocument()
    expect(screen.queryByTestId("stAlertDynamicIcon")).not.toBeInTheDocument()
    expect(
      screen.getByText("But our princess was in another castle!")
    ).toBeInTheDocument()
  })

  it("renders an INFO box as expected", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.INFO),
      body: "It's dangerous to go alone.",
    })
    render(<AlertElement {...props} />)
    expect(screen.getByTestId("stAlert")).toBeInTheDocument()
    expect(screen.getByTestId("stAlertContentInfo")).toBeInTheDocument()
    expect(screen.queryByTestId("stAlertDynamicIcon")).not.toBeInTheDocument()
    expect(screen.getByText("It's dangerous to go alone.")).toBeInTheDocument()
  })

  it("accepts an icon", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.INFO),
      body: "It's dangerous to go alone.",
      icon: "👉🏻",
    })
    render(<AlertElement {...props} />)
    expect(screen.getByTestId("stAlert")).toBeInTheDocument()
    expect(screen.getByTestId("stAlertContentInfo")).toBeInTheDocument()
    expect(screen.getByTestId("stAlertDynamicIcon")).toHaveTextContent("👉🏻")
    expect(screen.getByText("It's dangerous to go alone.")).toBeInTheDocument()
  })

  it("renders a title when provided", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.INFO),
      body: "This is the body text.",
      title: "Important Notice",
    })
    render(<AlertElement {...props} />)
    expect(screen.getByTestId("stAlert")).toBeVisible()
    expect(screen.getByTestId("stAlertTitle")).toHaveTextContent(
      "Important Notice"
    )
    expect(screen.getByText("This is the body text.")).toBeVisible()
  })

  it("does not render title element when title is not provided", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.INFO),
      body: "Just the body.",
    })
    render(<AlertElement {...props} />)
    expect(screen.getByTestId("stAlert")).toBeVisible()
    expect(screen.queryByTestId("stAlertTitle")).not.toBeInTheDocument()
    expect(screen.getByText("Just the body.")).toBeVisible()
  })

  it("renders title with icon", () => {
    const props = getProps({
      kind: getAlertElementKind(AlertProto.Format.SUCCESS),
      body: "Operation completed successfully.",
      title: "Success!",
      icon: "✅",
    })
    render(<AlertElement {...props} />)
    expect(screen.getByTestId("stAlert")).toBeVisible()
    expect(screen.getByTestId("stAlertTitle")).toHaveTextContent("Success!")
    expect(screen.getByTestId("stAlertDynamicIcon")).toHaveTextContent("✅")
    expect(screen.getByText("Operation completed successfully.")).toBeVisible()
  })
})
