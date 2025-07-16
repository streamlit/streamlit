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

import { fireEvent, screen } from "@testing-library/react"

import { ImageList as ImageListProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { mockEndpoints } from "~lib/mocks/mocks"
import * as UseResizeObserver from "~lib/hooks/useResizeObserver"

import ImageList, { ImageListProps } from "./ImageList"

describe("ImageList Element", () => {
  const buildMediaURL = vi.fn().mockReturnValue("https://mock.media.url")
  const sendClientErrorToHost = vi.fn()

  const getProps = (
    elementProps: Partial<ImageListProto> = {}
  ): ImageListProps => ({
    element: ImageListProto.create({
      imgs: [
        { caption: "a", url: "/media/mockImage1.jpeg" },
        { caption: "b", url: "/media/mockImage2.jpeg" },
      ],
      width: -1,
      ...elementProps,
    }),
    endpoints: mockEndpoints({
      buildMediaURL: buildMediaURL,
      sendClientErrorToHost: sendClientErrorToHost,
    }),
  })

  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<ImageList {...props} />)
    expect(screen.getAllByRole("img")).toHaveLength(2)
  })

  it("renders explicit width for each image", () => {
    const props = getProps({ width: 300 })
    render(<ImageList {...props} />)

    const images = screen.getAllByRole("img")
    expect(images).toHaveLength(2)
    images.forEach(image => {
      expect(image).toHaveStyle("width: 300px")
    })
  })

  it("creates its `src` attribute using buildMediaURL", () => {
    const props = getProps()
    render(<ImageList {...props} />)
    const images = screen.getAllByRole("img")
    expect(images).toHaveLength(2)

    expect(buildMediaURL).toHaveBeenNthCalledWith(1, "/media/mockImage1.jpeg")
    expect(buildMediaURL).toHaveBeenNthCalledWith(2, "/media/mockImage2.jpeg")

    images.forEach(image => {
      expect(image).toHaveAttribute("src", "https://mock.media.url")
    })
  })

  it("has a caption", () => {
    const props = getProps()
    render(<ImageList {...props} />)

    const captions = screen.getAllByTestId("stImageCaption")
    expect(captions).toHaveLength(2)
    expect(captions[0]).toHaveTextContent("a")
    expect(captions[1]).toHaveTextContent("b")
  })

  it("renders explicit width for each caption", () => {
    const props = getProps({ width: 300 })
    render(<ImageList {...props} />)

    const captions = screen.getAllByTestId("stImageCaption")
    expect(captions).toHaveLength(2)
    captions.forEach(caption => {
      expect(caption).toHaveStyle("width: 300px")
    })
  })

  it("sends an CLIENT_ERROR message when the image source fails to load", () => {
    const props = getProps()
    render(<ImageList {...props} />)
    const images = screen.getAllByRole("img")
    expect(images).toHaveLength(2)

    // Trigger the error event on the first image using fireEvent
    fireEvent.error(images[0])

    // Verify the error was sent with correct parameters
    expect(sendClientErrorToHost).toHaveBeenCalledWith(
      "Image",
      "Image source failed to load",
      "onerror triggered",
      "https://mock.media.url/"
    )
  })
})
