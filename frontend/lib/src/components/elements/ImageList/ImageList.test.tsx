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

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { mockEndpoints } from "~lib/mocks/mocks"
import { render, renderWithContexts } from "~lib/test_util"

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

  describe("crossOrigin attribute", () => {
    it.each([
      { resourceCrossOriginMode: "anonymous" },
      { resourceCrossOriginMode: "use-credentials" },
      { resourceCrossOriginMode: undefined },
    ] as const)(
      "don't set crossOrigin attribute when window.__streamlit?.BACKEND_BASE_URL is not set",
      ({ resourceCrossOriginMode }) => {
        const props = getProps()
        renderWithContexts(<ImageList {...props} />, {
          libConfig: { resourceCrossOriginMode },
        })
        const images = screen.getAllByRole("img")
        expect(images).toHaveLength(2)
        images.forEach(image => {
          expect(image).not.toHaveAttribute("crossOrigin")
        })
      }
    )

    describe("with BACKEND_BASE_URL set", () => {
      const originalStreamlit = window.__streamlit

      beforeEach(() => {
        window.__streamlit = {
          BACKEND_BASE_URL: "https://backend.example.com:8080/app",
        }
      })

      afterEach(() => {
        window.__streamlit = originalStreamlit
      })

      it.each([
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous",
          imgs: [
            { caption: "a", url: "/media/image1.png" },
            { caption: "b", url: "/media/image2.png" },
          ],
          scenario: "relative URLs with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials",
          imgs: [
            { caption: "a", url: "/media/image1.png" },
            { caption: "b", url: "/media/image2.png" },
          ],
          scenario: "relative URLs with use-credentials mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: undefined,
          imgs: [
            { caption: "a", url: "/media/image1.png" },
            { caption: "b", url: "/media/image2.png" },
          ],
          scenario: "relative URLs with undefined mode",
        },
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous",
          imgs: [
            {
              caption: "a",
              url: "https://backend.example.com:8080/media/image1.png",
            },
            {
              caption: "b",
              url: "https://backend.example.com:8080/media/image2.png",
            },
          ],
          scenario: "same origin as BACKEND_BASE_URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials",
          imgs: [
            {
              caption: "a",
              url: "https://backend.example.com:8080/media/image1.png",
            },
            {
              caption: "b",
              url: "https://backend.example.com:8080/media/image2.png",
            },
          ],
          scenario:
            "same origin as BACKEND_BASE_URL with use-credentials mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: undefined,
          imgs: [
            {
              caption: "a",
              url: "https://backend.example.com:8080/media/image1.png",
            },
            {
              caption: "b",
              url: "https://backend.example.com:8080/media/image2.png",
            },
          ],
          scenario: "same origin as BACKEND_BASE_URL with undefined mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          imgs: [
            {
              caption: "a",
              url: "https://external.example.com/media/image1.png",
            },
            {
              caption: "b",
              url: "https://external.example.com/media/image2.png",
            },
          ],
          scenario: "different hostname than BACKEND_BASE_URL",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          imgs: [
            {
              caption: "a",
              url: "https://backend.example.com:9000/media/image1.png",
            },
            {
              caption: "b",
              url: "https://backend.example.com:9000/media/image2.png",
            },
          ],
          scenario: "different port than BACKEND_BASE_URL",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          imgs: [
            {
              caption: "a",
              url: "http://backend.example.com:8080/media/image1.png",
            },
            {
              caption: "b",
              url: "http://backend.example.com:8080/media/image2.png",
            },
          ],
          scenario: "different protocol than BACKEND_BASE_URL",
        },
      ] as const)(
        "sets crossOrigin to $expected when $scenario",
        ({ expected, resourceCrossOriginMode, imgs }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const props = getProps({ imgs: imgs as any })
          renderWithContexts(<ImageList {...props} />, {
            libConfig: { resourceCrossOriginMode },
          })
          const images = screen.getAllByRole("img")
          expect(images).toHaveLength(2)
          images.forEach(image => {
            if (expected) {
              expect(image).toHaveAttribute("crossOrigin", expected)
            } else {
              expect(image).not.toHaveAttribute("crossOrigin")
            }
          })
        }
      )
    })
  })
})
