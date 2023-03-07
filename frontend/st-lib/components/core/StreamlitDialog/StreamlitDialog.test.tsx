/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { Fragment } from "react"
import Modal from "src/components/shared/Modal"
import { mount } from "src/lib/test_util"
import { SessionInfo, Args as SessionInfoArgs } from "src/lib/SessionInfo"
import { StreamlitDialog, DialogType } from "./StreamlitDialog"

function flushPromises(): Promise<void> {
  return new Promise(process.nextTick)
}

describe("StreamlitDialog", () => {
  it("renders clear cache dialog and focuses clear cache button", async () => {
    const wrapper = mount(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          defaultAction: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    // Flush promises to give componentDidMount() a chance to run.
    await flushPromises()

    setTimeout(() => {
      expect(wrapper.find("button").at(1).is(":focus")).toBe(true)
    }, 0)
  })

  it("renders secondary dialog buttons properly", async () => {
    const wrapper = mount(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          defaultAction: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    expect(wrapper.find("StyledSecondaryButton")).toMatchSnapshot()
  })

  it("renders tertiary dialog buttons properly", async () => {
    const wrapper = mount(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          defaultAction: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    expect(wrapper.find("StyledTertiaryButton")).toMatchSnapshot()
  })
})

describe("aboutDialog", () => {
  beforeEach(() => {
    SessionInfo.current = new SessionInfo({
      appId: "aid",
      sessionId: "sessionId",
      streamlitVersion: "42.42.42",
      pythonVersion: "pv",
      installationId: "iid",
      installationIdV3: "iid3",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      userMapboxToken: "mpt",
    } as SessionInfoArgs)
  })

  afterEach(() => {
    const UnsafeSessionInfo = SessionInfo as any
    UnsafeSessionInfo.singleton = undefined
  })

  it("shows version string if SessionInfo exists", async () => {
    const wrapper = mount(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.ABOUT,
          onClose: () => {},
        })}
      </Fragment>
    )

    expect(wrapper.find(Modal).text()).toContain("Streamlit v42.42.42")
  })

  it("shows no version string if SessionInfo does not exist", async () => {
    SessionInfo.clearSession()

    const wrapper = mount(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.ABOUT,
          onClose: () => {},
        })}
      </Fragment>
    )
    expect(wrapper.find(Modal).exists()).toBe(true)
    expect(wrapper.find(Modal).text()).not.toContain("Streamlit v")
  })
})
