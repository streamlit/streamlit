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

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  ImageList as ImageListProto,
  type streamlit,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { mockEndpoints } from "~lib/mocks/mocks"
import { render, renderWithContexts } from "~lib/test_util"

import ImageList, { type ImageListProps } from "./ImageList"

// Mock StreamlitConfig using global mock state (see vitest.setup.ts)
vi.mock("@streamlit/utils", async () => {
  const actual = await vi.importActual("@streamlit/utils")
  return {
    ...actual,
    get StreamlitConfig() {
      return globalThis.__mockStreamlitConfig
    },
  }
})

describe("ImageList Element", () => {
  const buildMediaURL = vi.fn().mockReturnValue("https://mock.media.url")
  const sendClientErrorToHost = vi.fn()

  const getProps = (
    elementProps: Partial<ImageListProto> = {},
    widthConfig?: streamlit.WidthConfig.$Properties | null
  ): ImageListProps => ({
    element: ImageListProto.create({
      imgs: [
        { caption: "a", url: "/media/mockImage1.jpeg" },
        { caption: "b", url: "/media/mockImage2.jpeg" },
      ],
      ...elementProps,
    }),
    widthConfig,
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

  afterEach(() => {
    document.body.style.overflow = ""
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<ImageList {...props} />)
    expect(screen.getAllByRole("img")).toHaveLength(2)
  })

  describe("Link parameter", () => {
    it("renders image wrapped in link when link is provided", () => {
      const props = getProps({
        imgs: [{ caption: "a", url: "/media/mockImage1.jpeg" }],
        link: "https://streamlit.io",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).toBeVisible()
      expect(link).toHaveAttribute("href", "https://streamlit.io")
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noreferrer")
      expect(link).toHaveAttribute("aria-labelledby")
      expect(link).toHaveAccessibleName("a")
      expect(link).not.toHaveAttribute("aria-label")

      // Image should be inside the link
      const image = screen.getByRole("img")
      expect(link).toContainElement(image)
    })

    it("names the link from rendered caption plain text, not markdown source", () => {
      const props = getProps({
        imgs: [
          { caption: "**Revenue** by quarter", url: "/media/mockImage1.jpeg" },
        ],
        link: "https://streamlit.io",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).toHaveAccessibleName("Revenue by quarter")
      expect(link).not.toHaveAccessibleName("**Revenue** by quarter")
    })

    it("uses link URL as aria-label when no caption is provided", () => {
      const props = getProps({
        imgs: [{ url: "/media/mockImage1.jpeg" }],
        link: "https://streamlit.io",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).toHaveAttribute("aria-label", "https://streamlit.io")
    })

    it("uses non-empty alt as the link name when caption is absent", () => {
      const props = getProps({
        imgs: [{ url: "/media/mockImage1.jpeg", alt: "Product photo" }],
        link: "https://streamlit.io",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).toHaveAttribute("aria-label", "Product photo")
      expect(screen.getByRole("img")).toHaveAttribute("alt", "Product photo")
    })

    it("falls back from a caption that renders no text to alt or the URL", () => {
      // Label markdown strips horizontal rules, so `---` alone leaves no text.
      const props = getProps({
        imgs: [
          {
            caption: "---",
            url: "/media/mockImage1.jpeg",
            alt: "Product photo",
          },
        ],
        link: "https://streamlit.io",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).not.toHaveAttribute("aria-labelledby")
      expect(link).toHaveAttribute("aria-label", "Product photo")
      expect(link).toHaveAccessibleName("Product photo")
    })

    it("uses asynchronously rendered caption text as the link name", async () => {
      // Start with a caption that renders no text (stripped HR), then simulate
      // a plugin finishing and injecting visible caption content.
      const props = getProps({
        imgs: [
          {
            caption: "---",
            url: "/media/mockImage1.jpeg",
            alt: "Product photo",
          },
        ],
        link: "https://streamlit.io",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).toHaveAttribute("aria-label", "Product photo")

      screen
        .getByTestId("stImageCaption")
        .appendChild(document.createTextNode("Loaded caption"))

      await waitFor(() => {
        expect(link).toHaveAttribute("aria-labelledby")
      })
      expect(link).toHaveAccessibleName("Loaded caption")
    })

    it("keeps decorative empty alt on the img and names the link from the URL", () => {
      const props = getProps({
        imgs: [{ url: "/media/mockImage1.jpeg", alt: "" }],
        link: "https://streamlit.io",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).toHaveAttribute("aria-label", "https://streamlit.io")
      const img = screen.getByTestId("stImageContainer").querySelector("img")
      expect(img).toHaveAttribute("alt", "")
    })

    it("does not render link wrapper when link is not provided", () => {
      const props = getProps({
        imgs: [{ caption: "a", url: "/media/mockImage1.jpeg" }],
      })
      render(<ImageList {...props} />)

      expect(screen.queryByTestId("stImageLink")).not.toBeInTheDocument()
      expect(screen.getByRole("img")).toBeVisible()
    })

    it("does not render link wrapper when link is empty string", () => {
      const props = getProps({
        imgs: [{ caption: "a", url: "/media/mockImage1.jpeg" }],
        link: "",
      })
      render(<ImageList {...props} />)

      expect(screen.queryByTestId("stImageLink")).not.toBeInTheDocument()
      expect(screen.getByRole("img")).toBeVisible()
    })

    it("renders image with caption and link", () => {
      const props = getProps({
        imgs: [{ caption: "Test caption", url: "/media/mockImage1.jpeg" }],
        link: "https://example.com",
      })
      render(<ImageList {...props} />)

      const link = screen.getByTestId("stImageLink")
      expect(link).toBeVisible()

      const caption = screen.getByTestId("stImageCaption")
      expect(caption).toHaveTextContent("Test caption")
    })

    it.each([
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "java\nscript:alert(1)",
      "vbscript:msgbox(1)",
    ])(
      "does not wrap the image when the link URL is dangerous: %s",
      linkUrl => {
        const props = getProps({
          imgs: [{ caption: "a", url: "/media/mockImage1.jpeg" }],
          link: linkUrl,
        })
        render(<ImageList {...props} />)

        expect(screen.queryByTestId("stImageLink")).not.toBeInTheDocument()
        expect(screen.queryByRole("link")).not.toBeInTheDocument()
        expect(screen.getByRole("img")).toBeVisible()
        expect(screen.getByTestId("stImageCaption")).toHaveTextContent("a")
      }
    )
  })

  describe("Image alt attribute", () => {
    it("omits the img alt attribute when no alt is provided", () => {
      const props = getProps({
        imgs: [{ url: "/media/mockImage1.jpeg" }],
      })
      render(<ImageList {...props} />)

      expect(screen.getByRole("img")).not.toHaveAttribute("alt")
    })

    it("omits the img alt attribute on every image in a list", () => {
      const props = getProps({
        imgs: [
          { url: "/media/mockImage1.jpeg" },
          { url: "/media/mockImage2.jpeg" },
          { url: "/media/mockImage3.jpeg" },
        ],
      })
      render(<ImageList {...props} />)

      const images = screen.getAllByRole("img")
      expect(images).toHaveLength(3)
      for (const image of images) {
        expect(image).not.toHaveAttribute("alt")
      }
    })

    it("sets decorative empty alt and omits alt when unset", () => {
      const { rerender } = render(
        <ImageList
          {...getProps({
            imgs: [{ url: "/media/mockImage1.jpeg", alt: "" }],
          })}
        />
      )
      // Decorative images (alt="") are presentational and may be excluded
      // from the accessibility tree / getByRole("img").
      const decorativeImg = screen
        .getByTestId("stImageContainer")
        .querySelector("img")
      expect(decorativeImg).toHaveAttribute("alt", "")

      rerender(
        <ImageList
          {...getProps({
            imgs: [{ url: "/media/mockImage1.jpeg" }],
          })}
        />
      )
      const unlabeledImg = screen
        .getByTestId("stImageContainer")
        .querySelector("img")
      expect(unlabeledImg).not.toHaveAttribute("alt")
    })
  })

  describe("New width configuration system", () => {
    it("renders explicit width for each image when using pixelWidth", () => {
      const props = getProps({}, { pixelWidth: 300 })
      render(<ImageList {...props} />)

      const images = screen.getAllByRole("img")
      expect(images).toHaveLength(2)
      images.forEach(image => {
        expect(image).toHaveStyle("width: 300px")
      })
    })

    it("uses stretch width behavior when useStretch is true", () => {
      const props = getProps({}, { useStretch: true })
      render(<ImageList {...props} />)

      const images = screen.getAllByRole("img")
      expect(images).toHaveLength(2)
      // When useStretch is true, width should match the element width (250px from mock)
      images.forEach(image => {
        expect(image).toHaveStyle("width: 250px")
      })
    })

    it("uses content width behavior when useContent is true", () => {
      const props = getProps({}, { useContent: true })
      render(<ImageList {...props} />)

      const images = screen.getAllByRole("img")
      expect(images).toHaveLength(2)
      // When useContent is true, width should be 100% (original size)
      images.forEach(image => {
        expect(image).toHaveStyle("width: 100%")
      })
    })
  })

  describe("Fallback behavior", () => {
    it("defaults to content behavior when no widthConfig is provided", () => {
      const props = getProps()
      render(<ImageList {...props} />)

      const images = screen.getAllByRole("img")
      expect(images).toHaveLength(2)
      images.forEach(image => {
        expect(image).toHaveStyle("width: 100%")
      })
    })

    it("defaults to content behavior when widthConfig is null", () => {
      const props = getProps({}, null)
      render(<ImageList {...props} />)

      const images = screen.getAllByRole("img")
      images.forEach(image => {
        expect(image).toHaveStyle("width: 100%")
      })
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

  it("renders explicit width for each caption when using pixelWidth", () => {
    const props = getProps({}, { pixelWidth: 300 })
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

    images[0].dispatchEvent(new Event("error"))

    // Verify the error was sent with correct parameters
    expect(sendClientErrorToHost).toHaveBeenCalledWith(
      "Image",
      "Image source failed to load",
      "onerror triggered",
      "https://mock.media.url/"
    )
  })

  it("fills available width when rendered in fullscreen", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ImageList {...props} />)

    await user.click(screen.getByLabelText("Fullscreen"))

    screen.getAllByRole("img").forEach(image => {
      expect(image).toHaveStyle({ width: "100%", objectFit: "contain" })
    })

    await user.click(screen.getByLabelText("Close fullscreen"))
    expect(document.body.style.overflow).toBe("unset")
  })

  describe("toolbar accessible name", () => {
    it("uses a plain Fullscreen label for multi-image lists", () => {
      render(<ImageList {...getProps()} />)

      expect(
        screen.getByRole("button", { name: /^Fullscreen$/ })
      ).toBeInTheDocument()
    })

    it("composes a single-image caption into the Fullscreen aria-label", () => {
      render(
        <ImageList
          {...getProps({
            imgs: [
              {
                caption: "Black Square as PNG.",
                url: "/media/mockImage1.jpeg",
              },
            ],
          })}
        />
      )

      expect(
        screen.getByRole("button", {
          name: /^Fullscreen: Black Square as PNG\.$/,
        })
      ).toBeInTheDocument()
    })

    it("prefers a single-image alt over caption for the Fullscreen aria-label", () => {
      render(
        <ImageList
          {...getProps({
            imgs: [
              {
                caption: "Visible caption",
                url: "/media/mockImage1.jpeg",
                alt: "Sunrise over a mountain ridge",
              },
            ],
          })}
        />
      )

      expect(
        screen.getByRole("button", {
          name: /^Fullscreen: Sunrise over a mountain ridge$/,
        })
      ).toBeInTheDocument()
    })

    it("composes rendered caption plain text, not markdown source", () => {
      render(
        <ImageList
          {...getProps({
            imgs: [
              {
                caption: "**Revenue** by quarter",
                url: "/media/mockImage1.jpeg",
              },
            ],
          })}
        />
      )

      expect(
        screen.getByRole("button", {
          name: /^Fullscreen: Revenue by quarter$/,
        })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("button", {
          name: /Fullscreen: \*\*Revenue\*\*/,
        })
      ).not.toBeInTheDocument()
    })

    it("inserts spaces between caption block nodes in the Fullscreen name", () => {
      render(
        <ImageList
          {...getProps({
            imgs: [
              {
                caption: "Line one\n\nLine two",
                url: "/media/mockImage1.jpeg",
              },
            ],
          })}
        />
      )

      expect(
        screen.getByRole("button", {
          name: /^Fullscreen: Line one Line two$/,
        })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("button", {
          name: /Fullscreen: Line oneLine two/,
        })
      ).not.toBeInTheDocument()
    })

    it("omits caption context when the caption renders no text", () => {
      render(
        <ImageList
          {...getProps({
            imgs: [{ caption: "---", url: "/media/mockImage1.jpeg" }],
          })}
        />
      )

      expect(
        screen.getByRole("button", { name: /^Fullscreen$/ })
      ).toBeInTheDocument()
    })

    it("drops caption context when rerendering from one image to a gallery", () => {
      const { rerender } = render(
        <ImageList
          {...getProps({
            imgs: [
              {
                caption: "Black Square as PNG.",
                url: "/media/mockImage1.jpeg",
              },
            ],
          })}
        />
      )

      expect(
        screen.getByRole("button", {
          name: /^Fullscreen: Black Square as PNG\.$/,
        })
      ).toBeInTheDocument()

      rerender(
        <ImageList
          {...getProps({
            imgs: [
              {
                caption: "Black Square as PNG.",
                url: "/media/mockImage1.jpeg",
              },
              { caption: "b", url: "/media/mockImage2.jpeg" },
            ],
          })}
        />
      )

      expect(
        screen.getByRole("button", { name: /^Fullscreen$/ })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("button", {
          name: /Fullscreen: Black Square/,
        })
      ).not.toBeInTheDocument()
    })
  })

  describe("crossOrigin attribute", () => {
    it.each([
      { resourceCrossOriginMode: "anonymous" },
      { resourceCrossOriginMode: "use-credentials" },
      { resourceCrossOriginMode: undefined },
    ] as const)(
      "don't set crossOrigin attribute when StreamlitConfig.BACKEND_BASE_URL is not set",
      ({ resourceCrossOriginMode }) => {
        const props = getProps()
        renderWithContexts(<ImageList {...props} />, {
          libConfigContext: {
            resourceCrossOriginMode,
          },
        })
        const images = screen.getAllByRole("img")
        expect(images).toHaveLength(2)
        images.forEach(image => {
          expect(image).not.toHaveAttribute("crossOrigin")
        })
      }
    )

    describe("with BACKEND_BASE_URL set", () => {
      beforeEach(() => {
        globalThis.__mockStreamlitConfig.BACKEND_BASE_URL =
          "https://backend.example.com:8080/app"
      })

      afterEach(() => {
        globalThis.__mockStreamlitConfig = {}
      })

      it.each([
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous" as const,
          imgs: [
            { caption: "a", url: "/media/image1.png" },
            { caption: "b", url: "/media/image2.png" },
          ],
          scenario: "relative URLs with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials" as const,
          imgs: [
            { caption: "a", url: "/media/image1.png" },
            { caption: "b", url: "/media/image2.png" },
          ],
          scenario: "relative URLs with use-credentials mode",
        },
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous" as const,
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
          resourceCrossOriginMode: "use-credentials" as const,
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
      ])(
        "sets crossOrigin to $expected when $scenario",
        ({ expected, resourceCrossOriginMode, imgs }) => {
          const props = getProps({ imgs: imgs })
          renderWithContexts(<ImageList {...props} />, {
            libConfigContext: {
              resourceCrossOriginMode,
            },
          })
          const images = screen.getAllByRole("img")
          expect(images).toHaveLength(2)
          images.forEach(image => {
            expect(image).toHaveAttribute("crossOrigin", expected)
          })
        }
      )

      it.each([
        {
          resourceCrossOriginMode: undefined,
          imgs: [
            { caption: "a", url: "/media/image1.png" },
            { caption: "b", url: "/media/image2.png" },
          ],
          scenario: "relative URLs with undefined mode",
        },
        {
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
          resourceCrossOriginMode: "anonymous" as const,
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
          resourceCrossOriginMode: "anonymous" as const,
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
          resourceCrossOriginMode: "anonymous" as const,
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
      ])(
        "does not set crossOrigin when $scenario",
        ({ resourceCrossOriginMode, imgs }) => {
          const props = getProps({ imgs: imgs })
          renderWithContexts(<ImageList {...props} />, {
            libConfigContext: {
              resourceCrossOriginMode,
            },
          })
          const images = screen.getAllByRole("img")
          expect(images).toHaveLength(2)
          images.forEach(image => {
            expect(image).not.toHaveAttribute("crossOrigin")
          })
        }
      )
    })
  })
})
