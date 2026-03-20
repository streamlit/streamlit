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

import { type ReactNode } from "react"

import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ArrowTable } from "./ArrowTable"
import { EXAMPLE_DF } from "./mock_data"
import { Streamlit } from "./streamlit"
import {
  StreamlitComponentBase,
  withStreamlitConnection,
} from "./StreamlitReact"

const dispatchRenderEvent = <ArgType = unknown,>(args: ArgType): void => {
  Streamlit.events.dispatchEvent(
    new CustomEvent(Streamlit.RENDER_EVENT, {
      detail: {
        args,
        disabled: false,
        theme: undefined,
      },
    })
  )
}

class StaticComponent extends StreamlitComponentBase {
  override render(): ReactNode {
    return <>Static component</>
  }
}

describe("StreamlitReact", () => {
  it("the component should be empty initially", () => {
    const StreamlitComponent = withStreamlitConnection(StaticComponent)
    expect(document.body.innerHTML).toEqual("")

    render(<StreamlitComponent />)

    expect(document.body.innerHTML).toEqual("<div></div>")
  })

  it("the component should be visible after initialization", () => {
    const StreamlitComponent = withStreamlitConnection(StaticComponent)
    expect(document.body.innerHTML).toEqual("")

    render(<StreamlitComponent />)
    act(() => {
      dispatchRenderEvent({})
    })

    expect(screen.getByText("Static component")).toBeInTheDocument()
  })

  it("the component should receive arguments from the parent frame", () => {
    interface ComponentArgument {
      firstArg: string
    }

    class ComponentWithArguments extends StreamlitComponentBase<
      Record<string, never>,
      ComponentArgument
    > {
      override render(): JSX.Element {
        return <p>{this.props.args.firstArg}</p>
      }
    }

    const Component = withStreamlitConnection(ComponentWithArguments)
    render(<Component />)
    act(() => {
      dispatchRenderEvent({ firstArg: "Argument text 123" })
    })

    expect(screen.getByText("Argument text 123")).toBeInTheDocument()
  })

  it("the component should receive dataframe from the parent frame", () => {
    interface ComponentArgument {
      firstArg: ArrowTable
    }
    class DataframeComponent extends StreamlitComponentBase<
      Record<string, never>,
      ComponentArgument
    > {
      override render(): ReactNode {
        const firstArg = this.props.args.firstArg
        const { content } = firstArg.getCell(1, 1)
        return <>{String(content)}</>
      }
    }

    const Component = withStreamlitConnection(DataframeComponent)
    render(<Component />)
    const firstArg = new ArrowTable(
      EXAMPLE_DF.data,
      EXAMPLE_DF.index,
      EXAMPLE_DF.columns
    )
    act(() => {
      dispatchRenderEvent({ firstArg })
    })

    expect(screen.getByText("Jason")).toBeInTheDocument()
  })

  it("the component error should be visible", () => {
    class BrokenComponent extends StreamlitComponentBase {
      override render(): ReactNode {
        throw new Error("Error in component")
      }
    }

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const Component = withStreamlitConnection(BrokenComponent)
    render(<Component />)
    act(() => {
      dispatchRenderEvent({})
    })

    expect(screen.getByText("Component Error")).toBeInTheDocument()
    expect(screen.getByText("Error in component")).toBeInTheDocument()
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it("the component should update the frame height initially", () => {
    vi.spyOn(Streamlit, "setFrameHeight")

    const Component = withStreamlitConnection(StaticComponent)
    render(<Component />)
    act(() => {
      dispatchRenderEvent({})
    })

    expect(vi.mocked(Streamlit.setFrameHeight).mock.calls).toHaveLength(1)
    expect(screen.getByText("Static component")).toBeInTheDocument()
  })

  it("the component should update the frame height after updating the arguments", () => {
    vi.spyOn(Streamlit, "setFrameHeight")

    const Component = withStreamlitConnection(StaticComponent)
    render(<Component />)

    for (const value of [1, 2, 3]) {
      act(() => {
        dispatchRenderEvent({ value })
      })
    }

    expect(vi.mocked(Streamlit.setFrameHeight).mock.calls).toHaveLength(3)
  })
})
