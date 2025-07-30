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

import { render } from "@streamlit/lib"
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
})
