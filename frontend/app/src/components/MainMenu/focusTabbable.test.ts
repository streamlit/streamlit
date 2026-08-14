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

import { focusNextTabbable, focusPrevTabbable } from "./focusTabbable"

function setup(html: string): void {
  document.body.innerHTML = html
}

describe("focusNextTabbable", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("focuses the next tabbable element in document order", () => {
    setup(`
      <button id="a">A</button>
      <button id="b">B</button>
      <button id="c">C</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    const b = document.getElementById("b") as HTMLElement

    focusNextTabbable(a)
    expect(document.activeElement).toBe(b)
  })

  it("skips elements with negative tabIndex", () => {
    setup(`
      <button id="a">A</button>
      <button id="b" tabindex="-1">B</button>
      <button id="c">C</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    const c = document.getElementById("c") as HTMLElement

    focusNextTabbable(a)
    expect(document.activeElement).toBe(c)
  })

  it("skips disabled buttons", () => {
    setup(`
      <button id="a">A</button>
      <button id="b" disabled>B</button>
      <button id="c">C</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    const c = document.getElementById("c") as HTMLElement

    focusNextTabbable(a)
    expect(document.activeElement).toBe(c)
  })

  it("skips hidden elements", () => {
    setup(`
      <button id="a">A</button>
      <button id="b" hidden>B</button>
      <button id="c">C</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    const c = document.getElementById("c") as HTMLElement

    focusNextTabbable(a)
    expect(document.activeElement).toBe(c)
  })

  it("skips elements inside an inert subtree", () => {
    setup(`
      <button id="a">A</button>
      <div inert><button id="b">B</button></div>
      <button id="c">C</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    const c = document.getElementById("c") as HTMLElement

    focusNextTabbable(a)
    expect(document.activeElement).toBe(c)
  })

  it("does nothing when no next tabbable element exists", () => {
    setup(`
      <button id="a">A</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    a.focus()

    focusNextTabbable(a)
    // Focus stays where it was (on body, since next?.focus() is a no-op)
    expect(document.activeElement).toBe(a)
  })
})

describe("focusPrevTabbable", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("focuses the previous tabbable element in document order", () => {
    setup(`
      <button id="a">A</button>
      <button id="b">B</button>
      <button id="c">C</button>
    `)
    const b = document.getElementById("b") as HTMLElement
    const c = document.getElementById("c") as HTMLElement

    focusPrevTabbable(c)
    expect(document.activeElement).toBe(b)
  })

  it("skips disabled elements going backwards", () => {
    setup(`
      <button id="a">A</button>
      <button id="b" disabled>B</button>
      <button id="c">C</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    const c = document.getElementById("c") as HTMLElement

    focusPrevTabbable(c)
    expect(document.activeElement).toBe(a)
  })

  it("does nothing when no previous tabbable element exists", () => {
    setup(`
      <button id="a">A</button>
    `)
    const a = document.getElementById("a") as HTMLElement
    a.focus()

    focusPrevTabbable(a)
    expect(document.activeElement).toBe(a)
  })
})
