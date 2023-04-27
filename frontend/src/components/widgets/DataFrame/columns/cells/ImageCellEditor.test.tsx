/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import "@testing-library/jest-dom"

import { render } from "src/lib/test_util"

import { ImageCellEditor } from "./ImageCellEditor"

describe("ImageCellEditor", () => {
  test("renders an image with the correct src", () => {
    const urls = ["https://example.com/image.jpg"]
    render(
      <ImageCellEditor
        urls={urls}
        canWrite={false}
        onCancel={() => {}}
        onChange={() => {}}
      />
    )

    const imageElement = screen.getByRole("img")
    expect(imageElement).toHaveAttribute("src", urls[0])
  })

  test("renders a link with the correct href when imageData starts with 'http'", () => {
    const urls = ["https://example.com/image.jpg"]
    render(
      <ImageCellEditor
        urls={urls}
        canWrite={false}
        onCancel={() => {}}
        onChange={() => {}}
      />
    )

    const linkElement = screen.getByRole("link")
    expect(linkElement).toHaveAttribute("href", urls[0])
    expect(linkElement).toHaveAttribute("target", "_blank")
    expect(linkElement).toHaveAttribute("rel", "noreferrer noopener")
  })

  test("renders an image without a link when imageData does not start with 'http'", () => {
    const urls = ["/local/path/to/image.jpg"]
    render(
      <ImageCellEditor
        urls={urls}
        canWrite={false}
        onCancel={() => {}}
        onChange={() => {}}
      />
    )

    const imageElement = screen.getByRole("img")
    expect(imageElement).toHaveAttribute("src", urls[0])
    expect(screen.queryByRole("link")).toBeNull()
  })

  test("renders an empty image when urls prop is empty", () => {
    render(
      <ImageCellEditor
        urls={[]}
        canWrite={false}
        onCancel={() => {}}
        onChange={() => {}}
      />
    )

    const imageElement = screen.getByRole("img")
    expect(imageElement).toHaveAttribute("src", "")
  })
})
