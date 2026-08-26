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

import { screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  SNOWFLAKE_LEARN_MORE_URL,
  SNOWFLAKE_TRIAL_URL,
  STREAMLIT_COMMUNITY_CLOUD_DOCS_URL,
  STREAMLIT_DEPLOY_TUTORIAL_URL,
} from "@streamlit/app/src/urls"
import { mockSessionInfo } from "@streamlit/lib"
import { render } from "@streamlit/lib/testing"
import { GitInfo, IGitInfo } from "@streamlit/protobuf"

import { DeployDialog, DeployDialogProps } from "./DeployDialog"

const { GitStates } = GitInfo

const validGitInfo: IGitInfo = {
  repository: "my-repo",
  branch: "main",
  module: "streamlit_app.py",
  untrackedFiles: [],
  state: GitStates.DEFAULT,
}

const getProps = (
  overrides: Partial<DeployDialogProps> = {}
): DeployDialogProps => ({
  type: DialogType.DEPLOY_DIALOG,
  gitInfo: null,
  onClose: vi.fn(),
  showDeployError: vi.fn(),
  isDeployErrorModalOpen: false,
  metricsMgr: new MetricsManager(mockSessionInfo()),
  ...overrides,
})

/**
 * Render the dialog with a metrics spy attached to the component's
 * MetricsManager. Useful for asserting metrics events without rebuilding
 * the manager and props in every test. The spy-bound `metricsMgr` always
 * wins over caller `overrides`, so the spy cannot be silently shadowed.
 */
const renderWithMetricsSpy = (
  overrides: Partial<DeployDialogProps> = {}
): ReturnType<typeof vi.spyOn> => {
  const metricsMgr = new MetricsManager(mockSessionInfo())
  const enqueueSpy = vi
    .spyOn(metricsMgr, "enqueue")
    .mockImplementation(() => {})
  render(<DeployDialog {...getProps({ ...overrides, metricsMgr })} />)
  return enqueueSpy
}

describe("DeployDialog", () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null)
  })

  afterEach(() => {
    windowOpenSpy.mockRestore()
  })

  /** Click a top-level button by its accessible name. */
  const clickButton = async (name: string): Promise<void> => {
    await user.click(screen.getByRole("button", { name }))
  }

  /**
   * Get the deploy card root element whose heading matches the given title.
   * This avoids relying on the order of identically-labeled CTAs (e.g., the
   * three "Learn more" buttons).
   *
   * Each card has the structure:
   *   StyledDeployCard
   *     ├── StyledDeployCardBody (heading lives here)
   *     └── div > StyledActionsWrapper > BaseButton[]
   * so the heading's grandparent is the card root.
   */
  const getCardElementByTitle = (title: string): HTMLElement => {
    const heading = screen.getByText(title)
    const card = heading.parentElement?.parentElement
    if (!card) {
      throw new Error(`Could not locate deploy card for title "${title}"`)
    }
    return card
  }

  it("renders the modal header and three deploy option cards", () => {
    render(<DeployDialog {...getProps()} />)

    expect(screen.getByText("Deploy this app using...")).toBeVisible()

    expect(screen.getByAltText("Streamlit Logo")).toBeVisible()
    expect(screen.getByAltText("Snowflake")).toBeVisible()
    expect(screen.getByAltText("Rocket")).toBeVisible()

    expect(screen.getByText("Streamlit Community Cloud")).toBeVisible()
    expect(screen.getByText("Snowflake")).toBeVisible()
    expect(screen.getByText("Other platforms")).toBeVisible()
  })

  describe("Deploy now button (Community Cloud)", () => {
    it.each([
      {
        scenario: "gitInfo is null",
        gitInfo: null,
      },
      {
        scenario: "gitInfo is missing repo/branch/module in DEFAULT state",
        gitInfo: {
          repository: "",
          branch: "",
          module: "",
          untrackedFiles: [],
          state: GitStates.DEFAULT,
        },
      },
      {
        scenario: "gitInfo has HEAD_DETACHED state",
        gitInfo: { ...validGitInfo, state: GitStates.HEAD_DETACHED },
      },
      {
        scenario: "module is in untrackedFiles",
        gitInfo: { ...validGitInfo, untrackedFiles: ["streamlit_app.py"] },
      },
    ])(
      "shows a deploy error and does not open a URL when $scenario",
      async ({ gitInfo }) => {
        const showDeployError = vi.fn()
        render(<DeployDialog {...getProps({ gitInfo, showDeployError })} />)

        await clickButton("Deploy now")

        expect(showDeployError).toHaveBeenCalledWith(
          "Unable to deploy",
          expect.anything()
        )
        expect(windowOpenSpy).not.toHaveBeenCalled()
      }
    )

    it("opens the deploy URL with git params when gitInfo is valid", async () => {
      const showDeployError = vi.fn()
      const onClose = vi.fn()
      render(
        <DeployDialog
          {...getProps({ gitInfo: validGitInfo, showDeployError, onClose })}
        />
      )

      await clickButton("Deploy now")

      expect(showDeployError).not.toHaveBeenCalled()
      // isDeployErrorModalOpen defaults to false, so onClose should not fire.
      expect(onClose).not.toHaveBeenCalled()
      expect(windowOpenSpy).toHaveBeenCalledTimes(1)
      const [openedUrl, target] = windowOpenSpy.mock.calls[0]
      expect(target).toBe("_blank")

      const url = new URL(String(openedUrl))
      expect(url.searchParams.get("repository")).toBe("my-repo")
      expect(url.searchParams.get("branch")).toBe("main")
      expect(url.searchParams.get("mainModule")).toBe("streamlit_app.py")
    })

    it("calls onClose before opening URL when isDeployErrorModalOpen is true", async () => {
      const onClose = vi.fn()
      render(
        <DeployDialog
          {...getProps({
            gitInfo: validGitInfo,
            onClose,
            isDeployErrorModalOpen: true,
          })}
        />
      )

      await clickButton("Deploy now")

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(windowOpenSpy).toHaveBeenCalledTimes(1)
    })

    it("does not call onClose when isDeployErrorModalOpen is false", async () => {
      const onClose = vi.fn()
      render(
        <DeployDialog
          {...getProps({
            gitInfo: validGitInfo,
            onClose,
            isDeployErrorModalOpen: false,
          })}
        />
      )

      await clickButton("Deploy now")

      expect(onClose).not.toHaveBeenCalled()
      expect(windowOpenSpy).toHaveBeenCalledTimes(1)
    })

    it("enqueues a metrics event with deployButtonInDialog label", async () => {
      const enqueueSpy = renderWithMetricsSpy()

      await clickButton("Deploy now")

      expect(enqueueSpy).toHaveBeenCalledWith("menuClick", {
        label: "deployButtonInDialog",
      })
    })
  })

  describe.each([
    {
      label: "Community Cloud Learn more",
      cardTitle: "Streamlit Community Cloud",
      buttonName: "Learn more",
      url: STREAMLIT_COMMUNITY_CLOUD_DOCS_URL,
      metricsLabel: "readMoreCommunityCloudInDeployDialog",
    },
    {
      label: "Snowflake Start trial",
      cardTitle: "Snowflake",
      buttonName: "Start trial",
      url: SNOWFLAKE_TRIAL_URL,
      metricsLabel: "startTrialInDeployDialog",
    },
    {
      label: "Snowflake Learn more",
      cardTitle: "Snowflake",
      buttonName: "Learn more",
      url: SNOWFLAKE_LEARN_MORE_URL,
      metricsLabel: "learnMoreSnowflakeInDeployDialog",
    },
    {
      label: "Other platforms Learn more",
      cardTitle: "Other platforms",
      buttonName: "Learn more",
      url: STREAMLIT_DEPLOY_TUTORIAL_URL,
      metricsLabel: "readMoreDeployTutorialInDeployDialog",
    },
  ])("$label button", ({ cardTitle, buttonName, url, metricsLabel }) => {
    /** Click the named button inside the card identified by its heading. */
    const clickCardButton = async (): Promise<void> => {
      const button = within(getCardElementByTitle(cardTitle)).getByRole(
        "button",
        { name: buttonName }
      )
      await user.click(button)
    }

    it("opens the expected URL in a new tab", async () => {
      render(<DeployDialog {...getProps()} />)

      await clickCardButton()

      expect(windowOpenSpy).toHaveBeenCalledWith(url, "_blank")
    })

    it("enqueues a metrics event when clicked", async () => {
      const enqueueSpy = renderWithMetricsSpy()

      await clickCardButton()

      expect(enqueueSpy).toHaveBeenCalledWith("menuClick", {
        label: metricsLabel,
      })
    })
  })
})
