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

import { render, renderWithContexts } from "~lib/test_util"

import Balloons, { NUM_BALLOONS } from "./Balloons"

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

describe("Balloons element", () => {
  vi.useFakeTimers()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it("renders without crashing", () => {
    render(<Balloons scriptRunId="51522269" />)

    const balloonElement = screen.getByTestId("stBalloons")
    expect(balloonElement).toBeInTheDocument()
    expect(balloonElement).toHaveClass("stBalloons")

    const balloonImages = screen.getAllByRole("img")
    expect(balloonImages.length).toBe(NUM_BALLOONS)

    balloonImages.forEach(node => {
      expect(node).toHaveAttribute("src")
    })
  })

  it("uses correct top-level class", () => {
    render(<Balloons scriptRunId="51522269" />)

    const balloonElement = screen.getByTestId("stBalloons")
    expect(balloonElement).toHaveClass("stBalloons")
  })

  describe("crossOrigin attribute", () => {
    afterEach(() => {
      globalThis.__mockStreamlitConfig = {}
    })

    it("sets crossOrigin when BACKEND_BASE_URL is configured", () => {
      // Setup StreamlitConfig.BACKEND_BASE_URL
      globalThis.__mockStreamlitConfig.BACKEND_BASE_URL =
        "http://localhost:8501"

      renderWithContexts(<Balloons scriptRunId="51522269" />, {
        libConfigContext: {
          resourceCrossOriginMode: "anonymous",
        },
      })

      const balloonImages = screen.getAllByRole("img")
      balloonImages.forEach(node => {
        expect(node).toHaveAttribute("crossOrigin", "anonymous")
      })
    })

    it("does not set crossOrigin when BACKEND_BASE_URL is not configured (same-origin)", () => {
      renderWithContexts(<Balloons scriptRunId="51522269" />, {
        libConfigContext: {
          resourceCrossOriginMode: "anonymous",
        },
      })

      const balloonImages = screen.getAllByRole("img")
      balloonImages.forEach(node => {
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

        renderWithContexts(<Balloons scriptRunId="51522269" />, {
          libConfigContext: {
            resourceCrossOriginMode: undefined,
          },
        })

        const balloonImages = screen.getAllByRole("img")
        balloonImages.forEach(node => {
          expect(node).not.toHaveAttribute("crossOrigin")
        })
      }
    )
  })
})
