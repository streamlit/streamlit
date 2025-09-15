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

import { IAppPage } from "@streamlit/protobuf"

import { StreamlitEndpoints } from "./types"

/** Return a mock StreamlitEndpoints implementation. */
export function mockEndpoints(
  overrides: Partial<StreamlitEndpoints> = {}
): StreamlitEndpoints {
  return {
    setStaticConfigUrl: vi.fn(),
    sendClientErrorToHost: vi.fn(),
    checkSourceUrlResponse: vi.fn(),
    buildComponentURL: vi.fn(),
    buildMediaURL: vi.fn(),
    buildDownloadUrl: vi.fn(),
    buildFileUploadURL: vi.fn(),
    buildAppPageURL: vi
      .fn()
      .mockImplementation(
        (_pageLinkBaseURL: string, page: IAppPage, pageIndex: number) => {
          return `http://mock/app/page/${page.pageName}.${pageIndex}`
        }
      ),
    uploadFileUploaderFile: vi
      .fn()
      .mockRejectedValue(new Error("unimplemented mock endpoint")),
    deleteFileAtURL: vi
      .fn()
      .mockRejectedValue(new Error("unimplemented mock endpoint")),
    ...overrides,
  }
}
