/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fetchMock from "fetch-mock"
import { FileUploadManager } from "lib/FileUploadManager"
import { SessionInfo } from "lib/SessionInfo"
import { buildHttpUri } from "lib/UriUtil"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

function mockUploadResponseStatus(status: number): void {
  const response = { status: status }
  const options = { method: "post" }

  fetchMock.mock(
    buildHttpUri(MOCK_SERVER_URI, "upload_file"),
    response,
    options
  )
}

beforeEach(() => {
  fetchMock.config.sendAsJson = false
  SessionInfo.current = new SessionInfo({
    sessionId: "sessionId",
    streamlitVersion: "sv",
    pythonVersion: "pv",
    installationId: "iid",
    authorEmail: "ae",
    maxCachedMessageAge: 2,
    commandLine: "command line",
    mapboxToken: "mpt",
  })
})

afterEach(() => {
  fetchMock.restore()
  SessionInfo["singleton"] = undefined
})

test("uploads files correctly", async () => {
  const uploader = new FileUploadManager(() => MOCK_SERVER_URI)

  mockUploadResponseStatus(200)

  await expect(
    uploader.uploadFile("widgetId", "file.txt", 0, new Uint8Array([0, 1, 2]))
  ).resolves.toBeUndefined()
})

test("handles errors", async () => {
  const uploader = new FileUploadManager(() => MOCK_SERVER_URI)

  mockUploadResponseStatus(400)

  await expect(
    uploader.uploadFile("widgetId", "file.txt", 0, new Uint8Array([0, 1, 2]))
  ).rejects.toEqual(new Error("Failed to upload file.txt (status 400)"))
})
