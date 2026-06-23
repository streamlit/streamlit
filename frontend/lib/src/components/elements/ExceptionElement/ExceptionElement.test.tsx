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

import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MockInstance } from "vitest"

import { Config, Exception as ExceptionProto } from "@streamlit/protobuf"

import { render, renderWithContexts } from "~lib/test_util"

import ExceptionElement, { ExceptionElementProps } from "./ExceptionElement"

const getProps = (
  elementProps: Partial<ExceptionProto> = {}
): ExceptionElementProps => ({
  element: ExceptionProto.create({
    stackTrace: ["step 1", "step 2", "step 3"],
    type: "RuntimeError",
    message: "This is an exception of type RuntimeError",
    messageIsMarkdown: false,
    ...elementProps,
  }),
})

describe("ExceptionElement Element", () => {
  it("renders without crashing", () => {
    render(<ExceptionElement {...getProps()} />)

    const exceptionContainer = screen.getByTestId("stException")
    expect(exceptionContainer).toBeInTheDocument()
    expect(exceptionContainer).toHaveClass("stException")
  })

  it("should render the complete stack", () => {
    render(<ExceptionElement {...getProps()} />)

    expect(screen.getByText("Traceback:")).toBeInTheDocument()

    const traceRows = screen.getAllByTestId("stExceptionTraceRow")
    traceRows.forEach((row, index) => {
      expect(row).toHaveTextContent(`step ${index + 1}`)
    })
  })

  it("should render only the message when type and stack are empty", () => {
    render(<ExceptionElement {...getProps({ type: "", stackTrace: [] })} />)

    expect(screen.queryByText("RuntimeError")).not.toBeInTheDocument()
    expect(screen.queryByText("Traceback:")).not.toBeInTheDocument()

    expect(
      screen.getByText("This is an exception of type RuntimeError")
    ).toBeInTheDocument()
  })

  it("should render markdown when it has messageIsMarkdown", () => {
    render(<ExceptionElement {...getProps({ messageIsMarkdown: true })} />)

    expect(screen.getByTestId("stMarkdownContainer")).toBeInTheDocument()
  })

  it("should render if there's no message", () => {
    render(<ExceptionElement {...getProps({ message: "" })} />)

    expect(screen.getByText("RuntimeError")).toBeInTheDocument()
  })

  describe("Exception links visibility", () => {
    let originalLocation: Location
    let windowSpy: MockInstance

    beforeEach(() => {
      originalLocation = window.location
      windowSpy = vi.spyOn(window, "location", "get")
    })

    afterEach(() => {
      windowSpy.mockRestore()
    })

    it.each([
      ["localhost", undefined],
      ["localhost", Config.ShowErrorLinks.SHOW_ERROR_LINKS_AUTO],
      ["localhost", Config.ShowErrorLinks.SHOW_ERROR_LINKS_TRUE],
      ["foo.com", Config.ShowErrorLinks.SHOW_ERROR_LINKS_TRUE],
    ])("shows links: hostname=%s, config=%s", (hostname, showErrorLinks) => {
      windowSpy.mockReturnValue({ ...originalLocation, hostname })
      if (showErrorLinks === undefined) {
        render(<ExceptionElement {...getProps()} />)
      } else {
        renderWithContexts(<ExceptionElement {...getProps()} />, {
          libConfigContext: { showErrorLinks },
        })
      }
      expect(screen.getByText("Copy")).toBeInTheDocument()
      expect(screen.getByText("Ask Google")).toBeInTheDocument()
      expect(screen.getByText("Ask ChatGPT")).toBeInTheDocument()
    })

    it.each([
      ["foo.com", undefined],
      ["foo.com", Config.ShowErrorLinks.SHOW_ERROR_LINKS_AUTO],
      ["localhost", Config.ShowErrorLinks.SHOW_ERROR_LINKS_FALSE],
      ["foo.com", Config.ShowErrorLinks.SHOW_ERROR_LINKS_FALSE],
    ])("hides links: hostname=%s, config=%s", (hostname, showErrorLinks) => {
      windowSpy.mockReturnValue({ ...originalLocation, hostname })
      if (showErrorLinks === undefined) {
        render(<ExceptionElement {...getProps()} />)
      } else {
        renderWithContexts(<ExceptionElement {...getProps()} />, {
          libConfigContext: { showErrorLinks },
        })
      }
      expect(screen.queryByText("Copy")).not.toBeInTheDocument()
      expect(screen.queryByText("Ask Google")).not.toBeInTheDocument()
      expect(screen.queryByText("Ask ChatGPT")).not.toBeInTheDocument()
    })
  })

  describe("Skills install callout", () => {
    const SHOW_LINKS = Config.ShowErrorLinks.SHOW_ERROR_LINKS_TRUE

    it("shows the callout on an error when enabled and links are shown", () => {
      renderWithContexts(<ExceptionElement {...getProps()} />, {
        libConfigContext: { showErrorLinks: SHOW_LINKS },
        skillsInstallContext: { enabled: true },
      })
      expect(screen.getByTestId("stSkillsInstallCallout")).toBeVisible()
    })

    it("records the impression once when shown", () => {
      const onShown = vi.fn()
      renderWithContexts(<ExceptionElement {...getProps()} />, {
        libConfigContext: { showErrorLinks: SHOW_LINKS },
        skillsInstallContext: { enabled: true, onShown },
      })
      expect(onShown).toHaveBeenCalledTimes(1)
    })

    it("hides the callout when not enabled", () => {
      renderWithContexts(<ExceptionElement {...getProps()} />, {
        libConfigContext: { showErrorLinks: SHOW_LINKS },
        skillsInstallContext: { enabled: false },
      })
      expect(
        screen.queryByTestId("stSkillsInstallCallout")
      ).not.toBeInTheDocument()
    })

    it("hides the callout for warnings even when enabled", () => {
      renderWithContexts(
        <ExceptionElement {...getProps({ isWarning: true })} />,
        {
          libConfigContext: { showErrorLinks: SHOW_LINKS },
          skillsInstallContext: { enabled: true },
        }
      )
      expect(
        screen.queryByTestId("stSkillsInstallCallout")
      ).not.toBeInTheDocument()
    })

    it("hides the callout when error links are suppressed", () => {
      renderWithContexts(<ExceptionElement {...getProps()} />, {
        libConfigContext: {
          showErrorLinks: Config.ShowErrorLinks.SHOW_ERROR_LINKS_FALSE,
        },
        skillsInstallContext: { enabled: true },
      })
      expect(
        screen.queryByTestId("stSkillsInstallCallout")
      ).not.toBeInTheDocument()
    })

    it("shows at most one callout when several errors are on screen", () => {
      renderWithContexts(
        <>
          <ExceptionElement {...getProps()} />
          <ExceptionElement {...getProps()} />
        </>,
        {
          libConfigContext: { showErrorLinks: SHOW_LINKS },
          skillsInstallContext: { enabled: true },
        }
      )
      // Both error boxes render, but only the first claims the single slot.
      expect(screen.getAllByTestId("stException")).toHaveLength(2)
      expect(screen.getAllByTestId("stSkillsInstallCallout")).toHaveLength(1)
    })

    it("installs via the callout inside the error box", async () => {
      const user = userEvent.setup()
      const onInstall = vi
        .fn()
        .mockResolvedValue("Installed to .agents/skills")
      renderWithContexts(<ExceptionElement {...getProps()} />, {
        libConfigContext: { showErrorLinks: SHOW_LINKS },
        skillsInstallContext: { enabled: true, onInstall },
      })

      await user.click(screen.getByRole("button", { name: "Install skills" }))
      expect(onInstall).toHaveBeenCalledTimes(1)
    })

    it("confirms then removes itself from the error after a successful install", async () => {
      vi.useFakeTimers()
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const onInstall = vi
          .fn()
          .mockResolvedValue("Installed to .agents/skills")
        renderWithContexts(<ExceptionElement {...getProps()} />, {
          libConfigContext: { showErrorLinks: SHOW_LINKS },
          skillsInstallContext: { enabled: true, onInstall },
        })

        await user.click(
          screen.getByRole("button", { name: "Install skills" })
        )
        await act(async () => {
          await Promise.resolve()
        })
        // The success confirmation shows (and the install action is gone)...
        expect(screen.getByText(/Skills installed/)).toBeVisible()
        expect(
          screen.queryByRole("button", { name: "Install skills" })
        ).not.toBeInTheDocument()

        // ...then the whole callout removes itself from the error box, even
        // though it's still on screen (it isn't yanked mid-confirmation).
        act(() => {
          vi.advanceTimersByTime(2500)
        })
        expect(
          screen.queryByTestId("stSkillsInstallCallout")
        ).not.toBeInTheDocument()
        // The error itself stays put.
        expect(screen.getByTestId("stException")).toBeVisible()
      } finally {
        vi.useRealTimers()
      }
    })

    it("frees the single slot on unmount so a later error box can claim it", () => {
      const { rerenderWithContexts } = renderWithContexts(
        <ExceptionElement {...getProps()} />,
        {
          libConfigContext: { showErrorLinks: SHOW_LINKS },
          skillsInstallContext: { enabled: true },
        }
      )
      expect(screen.getAllByTestId("stSkillsInstallCallout")).toHaveLength(1)

      // The error box goes away (e.g. a rerun clears it): the slot is released.
      rerenderWithContexts(<div data-testid="placeholder" />)
      expect(
        screen.queryByTestId("stSkillsInstallCallout")
      ).not.toBeInTheDocument()

      // A fresh error box can then claim the freed slot (no permanent lock-out).
      rerenderWithContexts(<ExceptionElement {...getProps()} />)
      expect(screen.getAllByTestId("stSkillsInstallCallout")).toHaveLength(1)
    })
  })
})
