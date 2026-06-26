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
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

import Tag from "./Tag"

describe("Tag component", () => {
  it("renders label text", () => {
    render(<Tag label="hello" onRemove={vi.fn()} />)
    expect(screen.getByText("hello")).toBeInTheDocument()
  })

  it("has title='Delete' for test-selector compatibility", () => {
    render(<Tag label="hello" onRemove={vi.fn()} />)
    const tag = screen.getByTitle("Delete")
    expect(tag).toBeInTheDocument()
  })

  it("has accessible aria-label including the label text", () => {
    render(<Tag label="option a" onRemove={vi.fn()} />)
    const tag = screen.getByRole("button", { name: "Remove option a" })
    expect(tag).toBeInTheDocument()
  })

  it("calls onRemove with label when clicked", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Tag label="hello" onRemove={onRemove} />)

    await user.click(screen.getByTitle("Delete"))
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("hello")
  })

  it("calls onRemove with label when Enter is pressed", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Tag label="hello" onRemove={onRemove} />)

    const tag = screen.getByTitle("Delete")
    tag.focus()
    await user.keyboard("{Enter}")
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("hello")
  })

  it("does not call onRemove when disabled", async () => {
    // Setup with pointerEventsCheck disabled so we can simulate clicking an
    // element that has pointer-events:none (the disabled tag button).
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onRemove = vi.fn()
    render(<Tag label="hello" onRemove={onRemove} disabled />)

    const tag = screen.getByTitle("Delete")
    await user.click(tag)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it("renders with testid stTag", () => {
    render(<Tag label="hello" onRemove={vi.fn()} />)
    expect(screen.getByTestId("stTag")).toBeInTheDocument()
  })

  it("text span carries title for overflow tooltip", () => {
    render(<Tag label="very long label text" onRemove={vi.fn()} />)
    const textSpan = screen.getByText("very long label text")
    expect(textSpan).toHaveAttribute("title", "very long label text")
  })
})
