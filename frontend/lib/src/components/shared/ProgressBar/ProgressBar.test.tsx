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

import { render } from "~lib/test_util"

import ProgressBar, { Size } from "./ProgressBar"

describe("ProgressBar component", () => {
  it("renders without crashing", () => {
    render(<ProgressBar value={50} />)
    expect(screen.getByRole("progressbar")).toBeVisible()
  })

  it("sets aria-valuenow correctly", () => {
    render(<ProgressBar value={75} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "75"
    )
  })

  it("sets aria-valuemin and aria-valuemax defaults", () => {
    render(<ProgressBar value={50} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("clamps value above 100", () => {
    render(<ProgressBar value={150} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    )
  })

  it("clamps value below 0", () => {
    render(<ProgressBar value={-10} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0"
    )
  })

  it("forwards a custom aria-label", () => {
    render(<ProgressBar value={50} aria-label="Uploading" />)
    expect(
      screen.getByRole("progressbar", { name: "Uploading" })
    ).toBeVisible()
  })

  it("uses the default aria-label when none is provided", () => {
    render(<ProgressBar value={50} />)
    expect(screen.getByRole("progressbar", { name: "progress" })).toBeVisible()
  })

  it("renders the track element", () => {
    render(<ProgressBar value={50} />)
    expect(screen.getByTestId("stProgressBarTrack")).toBeVisible()
  })

  it("does not square top corners by default", () => {
    render(<ProgressBar value={50} />)
    expect(screen.getByTestId("stProgressBarTrack")).not.toHaveStyle({
      borderTopLeftRadius: "0",
    })
  })

  it("squares top corners when squareTopCorners is true", () => {
    render(<ProgressBar value={50} squareTopCorners />)
    const track = screen.getByTestId("stProgressBarTrack")
    expect(track).toHaveStyle({ borderTopLeftRadius: "0" })
    expect(track).toHaveStyle({ borderTopRightRadius: "0" })
  })

  it.each([Size.EXTRASMALL, Size.SMALL])(
    "renders with size %s without crashing",
    size => {
      render(<ProgressBar value={50} size={size} />)
      expect(screen.getByRole("progressbar")).toBeVisible()
    }
  )
})
