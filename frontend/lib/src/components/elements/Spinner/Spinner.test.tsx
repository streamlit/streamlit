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

import { act, screen, waitFor } from "@testing-library/react"
import { BaseProvider, LightTheme } from "baseui"

import { Spinner as SpinnerProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"

import Spinner, { SpinnerProps } from "./Spinner"

const getProps = (
  propOverrides: Partial<SpinnerProps> = {},
  elementOverrides: Partial<SpinnerProto> = {}
): SpinnerProps => ({
  element: SpinnerProto.create({
    text: "Loading...",
    ...elementOverrides,
  }),
  ...propOverrides,
})

describe("Spinner component", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders without crashing", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps()} />
      </BaseProvider>
    )

    const spinnerContainer = screen.getByTestId("stSpinner")
    expect(spinnerContainer).toBeInTheDocument()
    expect(spinnerContainer).toHaveClass("stSpinner")
  })

  it("sets the text and width correctly", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps()} />
      </BaseProvider>
    )

    const markdownText = screen.getByText("Loading...")
    expect(markdownText).toBeInTheDocument()
  })

  it("sets additional className/CSS for caching spinner", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps({}, { cache: true })} />
      </BaseProvider>
    )

    const spinnerContainer = screen.getByTestId("stSpinner")
    expect(spinnerContainer).toBeInTheDocument()

    expect(spinnerContainer).toHaveClass("stSpinner")
    expect(spinnerContainer).toHaveClass("stCacheSpinner")
    expect(spinnerContainer).toHaveStyle("paddingBottom: 1rem")
  })

  it("shows timer when showTime is true", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps({}, { showTime: true })} />
      </BaseProvider>
    )

    const spinnerContainer = screen.getByTestId("stSpinner")
    expect(spinnerContainer).toBeInTheDocument()
    expect(screen.getByText("(0.0 seconds)")).toBeInTheDocument()
  })

  it("updates timer based on system time", async () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps({}, { showTime: true })} />
      </BaseProvider>
    )

    // Initially shows 0.0 seconds
    expect(screen.getByText("(0.0 seconds)")).toBeInTheDocument()

    // Advance time by 1.5 seconds and trigger timer update
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    // Wait for the component to update - allow for some timing variance
    await waitFor(() => {
      expect(screen.getByText(/\(1\.[0-9] seconds\)/)).toBeInTheDocument()
    })

    // Advance time by another 3.2 seconds (total 4.7 seconds)
    act(() => {
      vi.advanceTimersByTime(3200)
    })

    await waitFor(() => {
      // Allow for some variance in timing - should be around 4.7 seconds
      expect(
        screen.getByText(/\([4-6]\.\d{1,2} seconds\)/)
      ).toBeInTheDocument()
    })
  })

  it("formats time correctly for different durations", async () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps({}, { showTime: true })} />
      </BaseProvider>
    )

    // Test seconds
    act(() => {
      vi.advanceTimersByTime(5300) // 5.3 seconds
    })

    await waitFor(() => {
      expect(screen.getByText(/\(5\.[0-9] seconds\)/)).toBeInTheDocument()
    })

    // Test minutes
    act(() => {
      vi.advanceTimersByTime(60000) // Additional 60 seconds (total 65.3 seconds)
    })

    await waitFor(() => {
      expect(
        screen.getByText(/\(1 minute, [5-7]\.[0-9] seconds\)/)
      ).toBeInTheDocument()
    })
  })

  it("does not show timer when showTime is false", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps({}, { showTime: false })} />
      </BaseProvider>
    )

    const spinnerContainer = screen.getByTestId("stSpinner")
    expect(spinnerContainer).toBeInTheDocument()

    // Should not find any timer text
    expect(screen.queryByText(/seconds/)).not.toBeInTheDocument()
  })
})
