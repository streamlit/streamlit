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

import {
  SessionInfo,
  Props as SessionInfoProps,
} from "@streamlit/lib/src/SessionInfo"
import { StreamlitEndpoints } from "@streamlit/lib/src/StreamlitEndpoints"
import { IAppPage } from "@streamlit/lib/src/proto"

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
    isHello: false,
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
    buildFileUploadURL: jest.fn(),
    buildAppPageURL: jest
      .fn()
      .mockImplementation(
        (pageLinkBaseURL: string, page: IAppPage, pageIndex: number) => {
          return `http://mock/app/page/${page.pageName}.${pageIndex}`
        }
      ),
    uploadFileUploaderFile: jest
      .fn()
      .mockRejectedValue(new Error("unimplemented mock endpoint")),
    deleteFileAtURL: jest
      .fn()
      .mockRejectedValue(new Error("unimplemented mock endpoint")),
    fetchCachedForwardMsg: jest
      .fn()
      .mockRejectedValue(new Error("unimplemented mock endpoint")),
    ...overrides,
  }
}
