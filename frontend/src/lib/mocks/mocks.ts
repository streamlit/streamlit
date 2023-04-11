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
import {
  CustomComponentCounter,
  DeltaCounter,
  MetricsManager,
} from "src/lib/MetricsManager"

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
    authorEmail: "mockAuthorEmail",
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
  private sessionInfo

  public constructor(sessionInfo?: SessionInfo) {
    this.sessionInfo = sessionInfo
  }

  enqueue(_evName: string, _evData: Record<string, any>): void {}

  incrementDeltaCounter(_deltaType: string): void {}

  getAndResetDeltaCounter(): DeltaCounter {
    return {}
  }

  clearDeltaCounter(): void {
    throw new Error("Method not implemented.")
  }

  incrementCustomComponentCounter(_customInstanceName: string): void {}

  getAndResetCustomComponentCounter(): CustomComponentCounter {
    return {}
  }

  clearCustomComponentCounter(): void {}
}

/** Return a mock MetricsManager implementation */
export function mockMetricManager(
  sessionInfo?: SessionInfo
): MockMetricsManager {
  const mm = new MockMetricsManager(sessionInfo)
  // @ts-expect-error
  mm.track = jest.fn()
  // @ts-expect-error
  mm.identify = jest.fn()
  return mm
}
