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

import { Props as SessionInfoProps, SessionInfo } from "src/lib/SessionInfo"
import { StreamlitEndpoints } from "src/lib/StreamlitEndpoints"
import { MetricsManager } from "src/lib/MetricsManager"

/** Create mock SessionInfo.props */
export function mockSessionInfoProps(
  overrides: Partial<SessionInfoProps> = {}
): SessionInfoProps {
  return {
    appId: "mockAppId",
    sessionId: "mockSessionId",
    streamlitVersion: "mockStreamlitVersion",
    pythonVersion: "mockPythonVersion",
    installationId: "mockInstallationId",
    installationIdV3: "mockInstallationIdV3",
    maxCachedMessageAge: 123,
    commandLine: "mockCommandLine",
    userMapboxToken: "mockUserMapboxToken",
    ...overrides,
  }
}

/** Create a SessionInfo instance, with a mocked set of current props. */
export function mockSessionInfo(
  overrides: Partial<SessionInfoProps> = {}
): SessionInfo {
  const sessionInfo = new SessionInfo()
  sessionInfo.setCurrent(mockSessionInfoProps(overrides))
  return sessionInfo
}

/** Return a mock StreamlitEndpoints implementation. */
export function mockEndpoints(
  overrides: Partial<StreamlitEndpoints> = {}
): StreamlitEndpoints {
  return {
    buildComponentURL: jest.fn(),
    buildMediaURL: jest.fn(),
    buildAppPageURL: jest.fn(),
    uploadFileUploaderFile: jest
      .fn()
      .mockRejectedValue(new Error("unimplemented mock endpoint")),
    fetchCachedForwardMsg: jest
      .fn()
      .mockRejectedValue(new Error("unimplemented mock endpoint")),
    ...overrides,
  }
}

export class MockMetricsManager implements MetricsManager {
  public enqueue = jest.fn()

  public incrementDeltaCounter = jest.fn()

  public getAndResetDeltaCounter = jest.fn()

  public clearDeltaCounter = jest.fn()

  public incrementCustomComponentCounter = jest.fn()

  public getAndResetCustomComponentCounter = jest.fn()

  public clearCustomComponentCounter = jest.fn()
}
