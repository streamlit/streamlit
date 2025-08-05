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

import { render, renderWithContexts } from "~lib/test_util"

import Balloons, { NUM_BALLOONS } from "./Balloons"

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
      "sets crossOrigin attribute when resourceCrossOriginMode is configured ($description)",
      ({ backendBaseUrl }) => {
        // Setup window.__streamlit.BACKEND_BASE_URL if specified
        if (backendBaseUrl) {
          window.__streamlit = window.__streamlit || {}
          window.__streamlit.BACKEND_BASE_URL = backendBaseUrl
        }

        renderWithContexts(<Balloons scriptRunId="51522269" />, {
          libConfig: { resourceCrossOriginMode: "anonymous" },
        })

        const balloonImages = screen.getAllByRole("img")
        balloonImages.forEach(node => {
          if (backendBaseUrl) {
            // When BACKEND_BASE_URL is set, crossOrigin should be set for relative URLs
            expect(node).toHaveAttribute("crossOrigin", "anonymous")
          } else {
            // When BACKEND_BASE_URL is not set, crossOrigin should not be set for relative URLs (same-origin)
            expect(node).not.toHaveAttribute("crossOrigin")
          }
        })
      }
    )

    it.each(scenarios)(
      "does not set crossOrigin attribute when resourceCrossOriginMode is undefined ($description)",
      ({ backendBaseUrl }) => {
        // Setup window.__streamlit.BACKEND_BASE_URL if specified
        if (backendBaseUrl) {
          window.__streamlit = window.__streamlit || {}
          window.__streamlit.BACKEND_BASE_URL = backendBaseUrl
        }

        renderWithContexts(<Balloons scriptRunId="51522269" />, {
          libConfig: { resourceCrossOriginMode: undefined },
        })

        const balloonImages = screen.getAllByRole("img")
        balloonImages.forEach(node => {
          expect(node).not.toHaveAttribute("crossOrigin")
        })
      }
    )
  })
})
