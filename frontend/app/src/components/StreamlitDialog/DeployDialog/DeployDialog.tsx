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

import React, { ReactElement, ReactNode, useCallback } from "react"

import { StyledAction, StyledBody } from "baseui/card"

import StreamlitLogo from "@streamlit/app/src/assets/svg/logo.svg"
import Rocket from "@streamlit/app/src/assets/svg/rocket.svg"
import Snowflake from "@streamlit/app/src/assets/svg/snowflake.svg"
import { useAppContext } from "@streamlit/app/src/components/StreamlitContextProvider"
import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import {
  DetachedHead,
  ModuleIsNotAdded,
  NoRepositoryDetected,
} from "@streamlit/app/src/components/StreamlitDialog/DeployErrorDialogs"
import { PlainEventHandler } from "@streamlit/app/src/components/StreamlitDialog/StreamlitDialog"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  DEPLOY_URL,
  SNOWFLAKE_LEARN_MORE_URL,
  SNOWFLAKE_TRIAL_URL,
  STREAMLIT_CLOUD_URL,
  STREAMLIT_COMMUNITY_CLOUD_DOCS_URL,
  STREAMLIT_DEPLOY_TUTORIAL_URL,
} from "@streamlit/app/src/urls"
import { BaseButton, BaseButtonKind } from "@streamlit/lib"
import { GitInfo, IGitInfo } from "@streamlit/protobuf"

import Card from "./DeployCard"
import ListElement from "./DeployListElement"
import Modal from "./DeployModal"
import {
  StyledActionsWrapper,
  StyledCardContainer,
  StyledHeader,
  StyledSubheader,
} from "./styled-components"

const { GitStates } = GitInfo

const openUrl = (url: string): void => {
  window.open(url, "_blank")
}

const getDeployAppUrl = (gitInfo: IGitInfo | null): string => {
  if (gitInfo) {
    // If the app was run inside a GitHub repo, autofill for a one-click deploy.
    // E.g.: https://share.streamlit.io/deploy?repository=melon&branch=develop&mainModule=streamlit_app.py
    const deployUrl = new URL(DEPLOY_URL)

    deployUrl.searchParams.set("repository", gitInfo.repository ?? "")
    deployUrl.searchParams.set("branch", gitInfo.branch ?? "")
    deployUrl.searchParams.set("mainModule", gitInfo.module ?? "")
    return deployUrl.toString()
  }
  // If not in git repo, direct them to the Streamlit Cloud page.
  return STREAMLIT_CLOUD_URL
}

export interface DeployDialogProps {
  type: DialogType.DEPLOY_DIALOG
  onClose: PlainEventHandler
  showDeployError: (
    title: string,
    errorNode: ReactNode,
    onContinue?: () => void
  ) => void
  isDeployErrorModalOpen: boolean
  metricsMgr: MetricsManager
}

export function DeployDialog(
  props: Readonly<DeployDialogProps>
): ReactElement {
  // Get latest git info from AppContext:
  const { gitInfo } = useAppContext()
  const { onClose, metricsMgr, showDeployError, isDeployErrorModalOpen } =
    props
  const onClickDeployApp = useCallback((): void => {
    metricsMgr.enqueue("menuClick", {
      label: "deployButtonInDialog",
    })

    if (!gitInfo) {
      const dialog = NoRepositoryDetected()

      showDeployError(dialog.title, dialog.body)

      return
    }

    const {
      repository,
      branch,
      module,
      untrackedFiles,
      state: gitState,
    } = gitInfo
    const hasMissingGitInfo = !repository || !branch || !module

    if (hasMissingGitInfo && gitState === GitStates.DEFAULT) {
      const dialog = NoRepositoryDetected()

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (gitState === GitStates.HEAD_DETACHED) {
      const dialog = DetachedHead()

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (module && untrackedFiles?.includes(module)) {
      const dialog = ModuleIsNotAdded(module)

      showDeployError(dialog.title, dialog.body)

      return
    }

    // We should close the modal when we try again and everything goes fine
    if (isDeployErrorModalOpen) {
      onClose()
    }

    openUrl(getDeployAppUrl(gitInfo))
  }, [metricsMgr, gitInfo, isDeployErrorModalOpen, showDeployError, onClose])

  return (
    <Modal onClose={onClose}>
      <StyledCardContainer>
        <Card>
          <StyledBody style={{ flexGrow: 1 }}>
            <img
              src={StreamlitLogo}
              alt={"Streamlit Logo"}
              data-testid={"stDeployDialogCommunityCloudIcon"}
            />
            <StyledHeader>Streamlit Community Cloud</StyledHeader>
            <StyledSubheader>For community, always free</StyledSubheader>
            <ListElement>For personal hobbies and learning</ListElement>
            <ListElement>Deploy unlimited public apps</ListElement>
            <ListElement>
              Explore and learn from Streamlit’s community and popular apps
            </ListElement>
          </StyledBody>
          <StyledAction>
            <StyledActionsWrapper>
              <BaseButton
                kind={BaseButtonKind.PRIMARY}
                onClick={onClickDeployApp}
              >
                Deploy now
              </BaseButton>
              <BaseButton
                onClick={() => {
                  metricsMgr.enqueue("menuClick", {
                    label: "readMoreCommunityCloudInDeployDialog",
                  })
                  openUrl(STREAMLIT_COMMUNITY_CLOUD_DOCS_URL)
                }}
                kind={BaseButtonKind.MINIMAL}
              >
                Learn more
              </BaseButton>
            </StyledActionsWrapper>
          </StyledAction>
        </Card>
        <Card>
          <StyledBody style={{ flexGrow: 1 }}>
            <img
              src={Snowflake}
              alt={"Snowflake"}
              data-testid={"stDeployDialogSnowflakeDeploymentIcon"}
            />
            <StyledHeader>Snowflake</StyledHeader>
            <StyledSubheader>For enterprise</StyledSubheader>
            <ListElement>
              Enterprise-level security, support, and fully managed
              infrastructure
            </ListElement>
            <ListElement>
              Deploy unlimited private apps with role-based sharing
            </ListElement>
            <ListElement>
              Integrate with Snowflake’s full data stack
            </ListElement>
          </StyledBody>
          <StyledAction>
            <StyledActionsWrapper>
              <BaseButton
                kind={BaseButtonKind.SECONDARY}
                onClick={() => {
                  metricsMgr.enqueue("menuClick", {
                    label: "startTrialInDeployDialog",
                  })
                  openUrl(SNOWFLAKE_TRIAL_URL)
                }}
              >
                Start trial
              </BaseButton>
              <BaseButton
                onClick={() => {
                  metricsMgr.enqueue("menuClick", {
                    label: "learnMoreSnowflakeInDeployDialog",
                  })
                  openUrl(SNOWFLAKE_LEARN_MORE_URL)
                }}
                kind={BaseButtonKind.MINIMAL}
              >
                Learn more
              </BaseButton>
            </StyledActionsWrapper>
          </StyledAction>
        </Card>
        <Card>
          <StyledBody style={{ flexGrow: 2 }}>
            <img
              src={Rocket}
              alt={"Rocket"}
              data-testid={"stDeployDialogCustomDeploymentIcon"}
            />
            <StyledHeader>Other platforms</StyledHeader>
            <StyledSubheader>For custom deployment </StyledSubheader>
            <ListElement>
              Deploy on your own hardware or cloud service
            </ListElement>
            <ListElement>
              Set up and maintain your own authentication, resources, and costs
            </ListElement>
          </StyledBody>
          <StyledAction>
            <StyledActionsWrapper>
              <BaseButton
                onClick={() => {
                  metricsMgr.enqueue("menuClick", {
                    label: "readMoreDeployTutorialInDeployDialog",
                  })
                  openUrl(STREAMLIT_DEPLOY_TUTORIAL_URL)
                }}
                kind={BaseButtonKind.MINIMAL}
              >
                Learn more
              </BaseButton>
            </StyledActionsWrapper>
          </StyledAction>
        </Card>
      </StyledCardContainer>
    </Modal>
  )
}
