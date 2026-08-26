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

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { GlobalHotkeys } from "./GlobalHotkeys"

describe("GlobalHotkeys", () => {
  it("calls handlers for configured key presses", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    const onKeyUp = vi.fn()
    render(
      <GlobalHotkeys keyName="r,esc" onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
        <div>content</div>
      </GlobalHotkeys>
    )

    await user.keyboard("r{Escape}")

    expect(onKeyDown.mock.calls.map(call => call[0])).toEqual(["r", "esc"])
    expect(onKeyUp.mock.calls.map(call => call[0])).toEqual(["r", "esc"])
  })

  it("ignores modifier shortcuts, repeat events, and their keyup events", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    const onKeyUp = vi.fn()
    render(
      <GlobalHotkeys keyName="c" onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
        <div>content</div>
      </GlobalHotkeys>
    )

    await user.keyboard("{Meta>}c{/Meta}")
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", repeat: true, bubbles: true })
    )

    expect(onKeyDown).not.toHaveBeenCalled()
    expect(onKeyUp).not.toHaveBeenCalled()
  })

  it("still fires letter shortcuts when Shift is held", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="r,c" onKeyDown={onKeyDown}>
        <div>content</div>
      </GlobalHotkeys>
    )

    await user.keyboard("{Shift>}r{/Shift}")

    expect(onKeyDown).toHaveBeenCalledWith("r", expect.any(KeyboardEvent))
  })

  it("suppresses duplicate keydowns until keyup or window blur", () => {
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="r" onKeyDown={onKeyDown}>
        <div>content</div>
      </GlobalHotkeys>
    )

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", bubbles: true })
    )
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", bubbles: true })
    )
    expect(onKeyDown).toHaveBeenCalledOnce()

    window.dispatchEvent(new Event("blur"))
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", bubbles: true })
    )
    expect(onKeyDown).toHaveBeenCalledTimes(2)
  })

  it("ignores key presses from editable elements", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="a" onKeyDown={onKeyDown}>
        <input aria-label="editor" />
      </GlobalHotkeys>
    )

    await user.type(screen.getByLabelText("editor"), "a")

    expect(onKeyDown).not.toHaveBeenCalled()
  })
})
