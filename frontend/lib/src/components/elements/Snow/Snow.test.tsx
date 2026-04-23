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

import Snow, {
  NUM_FLAKES,
  Props as SnowProps,
} from "~lib/components/elements/Snow/Snow"
import { render, renderWithContexts } from "~lib/test_util"

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

const getProps = (): SnowProps => ({
  scriptRunId: "51522269",
})

describe("Snow element", () => {
  vi.useFakeTimers()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<Snow {...props} />)

    const snowElement = screen.getByTestId("stSnow")
    expect(snowElement).toBeInTheDocument()

    const snowImages = screen.getAllByRole("img")
    expect(snowImages.length).toBe(NUM_FLAKES)

    snowImages.forEach(node => {
      expect(node).toHaveAttribute("src")
    })
  })

  it("uses correct top-level class", { timeout: 10_000 }, () => {
    const props = getProps()
    render(<Snow {...props} />)

    const snowElement = screen.getByTestId("stSnow")
    expect(snowElement).toHaveClass("stSnow")
  })

  describe("crossOrigin attribute", () => {
    beforeEach(() => {
      globalThis.__mockStreamlitConfig = {}
    })

    afterEach(() => {
      globalThis.__mockStreamlitConfig = {}
    })

    it("sets crossOrigin when BACKEND_BASE_URL is configured", () => {
      // Setup StreamlitConfig.BACKEND_BASE_URL
      globalThis.__mockStreamlitConfig.BACKEND_BASE_URL =
        "http://localhost:8501"

      renderWithContexts(<Snow scriptRunId="51522269" />, {
        libConfigContext: {
          resourceCrossOriginMode: "anonymous",
        },
      })

      const snowImages = screen.getAllByRole("img")
      snowImages.forEach(node => {
        expect(node).toHaveAttribute("crossOrigin", "anonymous")
      })
    })

    it("does not set crossOrigin when BACKEND_BASE_URL is not configured (same-origin)", () => {
      renderWithContexts(<Snow scriptRunId="51522269" />, {
        libConfigContext: {
          resourceCrossOriginMode: "anonymous",
        },
      })

      const snowImages = screen.getAllByRole("img")
      snowImages.forEach(node => {
        expect(node).not.toHaveAttribute("crossOrigin")
      })
    })

    it.each([
      { backendBaseUrl: undefined, description: "without BACKEND_BASE_URL" },
      {
        backendBaseUrl: "http://localhost:8501",
        description: "with BACKEND_BASE_URL",
      },
    ])(
      "does not set crossOrigin attribute when resourceCrossOriginMode is undefined ($description)",
      ({ backendBaseUrl }) => {
        // Setup StreamlitConfig.BACKEND_BASE_URL if specified
        if (backendBaseUrl) {
          globalThis.__mockStreamlitConfig.BACKEND_BASE_URL = backendBaseUrl
        }

        renderWithContexts(<Snow scriptRunId="51522269" />, {
          libConfigContext: {
            resourceCrossOriginMode: undefined,
          },
        })

        const snowImages = screen.getAllByRole("img")
        snowImages.forEach(node => {
          expect(node).not.toHaveAttribute("crossOrigin")
        })
      }
    )
  })
})
