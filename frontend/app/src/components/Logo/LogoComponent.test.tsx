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

import { render, renderWithContexts } from "@streamlit/lib"
import { Logo as LogoProto } from "@streamlit/protobuf"

import LogoComponent from "./LogoComponent"

const mockEndpoints = {
  setStaticConfigUrl: vi.fn(),
  sendClientErrorToHost: vi.fn(),
  checkSourceUrlResponse: vi.fn(),
  buildComponentURL: vi.fn(
    (componentName: string, path: string) => `${componentName}/${path}`
  ),
  buildMediaURL: vi.fn((url: string) => url),
  buildDownloadUrl: vi.fn((url: string) => url),
  buildAppPageURL: vi.fn((_baseUrl, page) => page.pageName || ""),
  uploadFileUploaderFile: vi.fn(),
}

interface TestProps {
  appLogo: LogoProto | null
  collapsed: boolean
  endpoints: typeof mockEndpoints
  dataTestId?: string
}

const getProps = (props: Partial<TestProps> = {}): TestProps => ({
  appLogo: null,
  collapsed: false,
  endpoints: mockEndpoints,
  ...props,
})

describe("LogoComponent", () => {
  const sampleLogo = LogoProto.create({
    image: "https://example.com/logo.png",
    iconImage: "https://example.com/icon.png",
    link: "https://example.com",
    size: "medium",
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when appLogo is null", () => {
    const { container } = render(<LogoComponent {...getProps()} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders logo in header when dataTestId is stHeaderLogo", () => {
    render(
      <LogoComponent
        {...getProps({
          appLogo: sampleLogo,
          dataTestId: "stHeaderLogo",
        })}
      />
    )

    const logo = screen.getByTestId("stHeaderLogo")
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png")
  })

  it("renders logo in sidebar when dataTestId is stSidebarLogo", () => {
    render(
      <LogoComponent
        {...getProps({
          appLogo: sampleLogo,
          dataTestId: "stSidebarLogo",
        })}
      />
    )

    const logo = screen.getByTestId("stSidebarLogo")
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png")
  })

  it("uses iconImage when collapsed is true and iconImage exists", () => {
    render(
      <LogoComponent
        {...getProps({
          appLogo: sampleLogo,
          dataTestId: "stHeaderLogo",
          collapsed: true,
        })}
      />
    )

    const logo = screen.getByTestId("stHeaderLogo")
    expect(logo).toHaveAttribute("src", "https://example.com/icon.png")
    expect(mockEndpoints.buildMediaURL).toHaveBeenCalledWith(
      "https://example.com/icon.png"
    )
  })

  it("falls back to main image when collapsed but no iconImage", () => {
    const logoWithoutIcon = LogoProto.create({
      image: "https://example.com/logo.png",
      size: "medium",
    })

    render(
      <LogoComponent
        {...getProps({
          appLogo: logoWithoutIcon,
          dataTestId: "stHeaderLogo",
          collapsed: true,
        })}
      />
    )

    const logo = screen.getByTestId("stHeaderLogo")
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png")
  })

  it("renders logo with link when link is provided", () => {
    render(
      <LogoComponent
        {...getProps({
          appLogo: sampleLogo,
          dataTestId: "stHeaderLogo",
        })}
      />
    )

    const logoLink = screen.getByTestId("stLogoLink")
    expect(logoLink).toHaveAttribute("href", "https://example.com")
  })

  it("renders logo without link when no link provided", () => {
    const logoWithoutLink = LogoProto.create({
      image: "https://example.com/logo.png",
      size: "medium",
    })

    render(
      <LogoComponent
        {...getProps({
          appLogo: logoWithoutLink,
          dataTestId: "stHeaderLogo",
        })}
      />
    )

    expect(screen.queryByTestId("stLogoLink")).not.toBeInTheDocument()
    screen.getByTestId("stHeaderLogo")
  })

  it("applies correct size classes", () => {
    const smallLogo = LogoProto.create({
      image: "https://example.com/logo.png",
      size: "small",
    })

    const { rerender } = render(
      <LogoComponent
        {...getProps({
          appLogo: smallLogo,
          dataTestId: "stHeaderLogo",
        })}
      />
    )

    let logo = screen.getByTestId("stHeaderLogo")
    expect(logo).toHaveStyle("height: 1.25rem")

    const largeLogo = LogoProto.create({
      image: "https://example.com/logo.png",
      size: "large",
    })

    rerender(
      <LogoComponent
        {...getProps({
          appLogo: largeLogo,
          dataTestId: "stHeaderLogo",
        })}
      />
    )

    logo = screen.getByTestId("stHeaderLogo")
    expect(logo).toHaveStyle("height: 2rem")
  })

  describe("crossOrigin attribute", () => {
    const scenarios = [
      {
        backendBaseUrl: undefined,
        description: "without BACKEND_BASE_URL",
      },
      {
        backendBaseUrl: "http://localhost:8501",
        description: "with BACKEND_BASE_URL",
      },
    ]

    afterEach(() => {
      // Clean up window.__streamlit after each test
      if (window.__streamlit) {
        delete window.__streamlit.BACKEND_BASE_URL
      }
    })

    it.each(scenarios)(
      "sets crossOrigin attribute for relative URLs when resourceCrossOriginMode is configured ($description)",
      ({ backendBaseUrl }) => {
        // Setup window.__streamlit.BACKEND_BASE_URL if specified
        if (backendBaseUrl) {
          window.__streamlit = window.__streamlit || {}
          window.__streamlit.BACKEND_BASE_URL = backendBaseUrl
        }

        const logoWithRelativeUrl = LogoProto.create({
          image: "/media/logo.png",
          size: "medium",
        })

        renderWithContexts(
          <LogoComponent
            {...getProps({
              appLogo: logoWithRelativeUrl,
              dataTestId: "stHeaderLogo",
            })}
          />,
          {
            libConfig: { resourceCrossOriginMode: "anonymous" },
          }
        )

        const logo = screen.getByTestId("stHeaderLogo")
        if (backendBaseUrl) {
          // When BACKEND_BASE_URL is set, crossOrigin should be set for relative URLs
          expect(logo).toHaveAttribute("crossOrigin", "anonymous")
        } else {
          // When BACKEND_BASE_URL is not set, crossOrigin should not be set for relative URLs (same-origin)
          expect(logo).not.toHaveAttribute("crossOrigin")
        }
      }
    )

    it("sets crossOrigin attribute for backend URLs when configured", () => {
      window.__streamlit = window.__streamlit || {}
      window.__streamlit.BACKEND_BASE_URL = "http://localhost:8501"

      const logoWithBackendUrl = LogoProto.create({
        image: "http://localhost:8501/media/logo.png",
        iconImage: "http://localhost:8501/media/icon.png",
        size: "medium",
      })

      const { rerender } = renderWithContexts(
        <LogoComponent
          {...getProps({
            appLogo: logoWithBackendUrl,
            dataTestId: "stHeaderLogo",
            collapsed: false,
          })}
        />,
        {
          libConfig: { resourceCrossOriginMode: "anonymous" },
        }
      )

      // Test main image
      let logo = screen.getByTestId("stHeaderLogo")
      expect(logo).toHaveAttribute("crossOrigin", "anonymous")
      expect(logo).toHaveAttribute(
        "src",
        "http://localhost:8501/media/logo.png"
      )

      // Test icon image when collapsed
      rerender(
        <LogoComponent
          {...getProps({
            appLogo: logoWithBackendUrl,
            dataTestId: "stHeaderLogo",
            collapsed: true,
          })}
        />
      )

      logo = screen.getByTestId("stHeaderLogo")
      expect(logo).toHaveAttribute("crossOrigin", "anonymous")
      expect(logo).toHaveAttribute(
        "src",
        "http://localhost:8501/media/icon.png"
      )
    })

    it("does not set crossOrigin attribute for external URLs", () => {
      window.__streamlit = window.__streamlit || {}
      window.__streamlit.BACKEND_BASE_URL = "http://localhost:8501"

      renderWithContexts(
        <LogoComponent
          {...getProps({
            appLogo: sampleLogo, // Uses https://example.com URLs
            dataTestId: "stHeaderLogo",
          })}
        />,
        {
          libConfig: { resourceCrossOriginMode: "anonymous" },
        }
      )

      const logo = screen.getByTestId("stHeaderLogo")
      // External URLs should not have crossOrigin attribute set
      expect(logo).not.toHaveAttribute("crossOrigin")
      expect(logo).toHaveAttribute("src", "https://example.com/logo.png")
    })

    it.each(scenarios)(
      "does not set crossOrigin attribute when resourceCrossOriginMode is undefined ($description)",
      ({ backendBaseUrl }) => {
        // Setup window.__streamlit.BACKEND_BASE_URL if specified
        if (backendBaseUrl) {
          window.__streamlit = window.__streamlit || {}
          window.__streamlit.BACKEND_BASE_URL = backendBaseUrl
        }

        const logoWithRelativeUrl = LogoProto.create({
          image: "/media/logo.png",
          size: "medium",
        })

        renderWithContexts(
          <LogoComponent
            {...getProps({
              appLogo: logoWithRelativeUrl,
              dataTestId: "stHeaderLogo",
            })}
          />,
          {
            libConfig: { resourceCrossOriginMode: undefined },
          }
        )

        const logo = screen.getByTestId("stHeaderLogo")
        expect(logo).not.toHaveAttribute("crossOrigin")
      }
    )

    it("works with use-credentials mode", () => {
      window.__streamlit = window.__streamlit || {}
      window.__streamlit.BACKEND_BASE_URL = "http://localhost:8501"

      const logoWithRelativeUrl = LogoProto.create({
        image: "/media/logo.png",
        size: "medium",
      })

      renderWithContexts(
        <LogoComponent
          {...getProps({
            appLogo: logoWithRelativeUrl,
            dataTestId: "stSidebarLogo",
          })}
        />,
        {
          libConfig: { resourceCrossOriginMode: "use-credentials" },
        }
      )

      const logo = screen.getByTestId("stSidebarLogo")
      expect(logo).toHaveAttribute("crossOrigin", "use-credentials")
    })
  })
})
