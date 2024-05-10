/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { HostCommunicationManager, SessionInfo } from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"
import {
  AppNavigation,
  PageUrlUpdateCallback,
  PageNotFoundCallback,
} from "./AppNavigation"

describe("AppNavigation", () => {
  let hostCommunicationMgr: HostCommunicationManager
  let metricsMgr: SegmentMetricsManager
  let onUpdatePageUrl: PageUrlUpdateCallback
  let onPageNotFound: PageNotFoundCallback

  beforeEach(() => {
    hostCommunicationMgr = new HostCommunicationManager({
      sendRerunBackMsg: () => {},
      closeModal: () => {},
      stopScript: () => {},
      rerunScript: () => {},
      clearCache: () => {},
      sendAppHeartbeat: () => {},
      setInputsDisabled: () => {},
      themeChanged: () => {},
      pageChanged: () => {},
      isOwnerChanged: () => {},
      jwtHeaderChanged: () => {},
      hostMenuItemsChanged: () => {},
      hostToolbarItemsChanged: () => {},
      hostHideSidebarNavChanged: () => {},
      sidebarChevronDownshiftChanged: () => {},
      pageLinkBaseUrlChanged: () => {},
      queryParamsChanged: () => {},
      deployedAppMetadataChanged: () => {},
    })
    metricsMgr = new SegmentMetricsManager(new SessionInfo())
    onUpdatePageUrl = jest.fn()
    onPageNotFound = jest.fn()
  })

  // it("generates the correc state on new session", () => {
  //   const appNavigation = new AppNavigation(
  //     hostCommunicationMgr,
  //     metricsMgr,
  //     onUpdatePageUrl,
  //     onPageNotFound
  //   )

  //   const { hideSidebarNav, appPages, currentPageScriptHash } = appNavigation.handleNewSession({

  // })
})
