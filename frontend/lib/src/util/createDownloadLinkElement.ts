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

interface DownloadLinkElementParameters {
  enforceDownloadInNewTab: boolean
  url: string
  filename: string
}

const createDownloadLinkElement = ({
  enforceDownloadInNewTab,
  url,
  filename,
}: DownloadLinkElementParameters): HTMLAnchorElement => {
  const link = document.createElement("a")
  link.setAttribute("href", url)
  if (enforceDownloadInNewTab) {
    link.setAttribute("target", "_blank")
  } else {
    link.setAttribute("target", "_self")
  }

  // We don't set the download attribute when the window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL variable is set
  // and the passed url is a request to that origin. The reason is that there is a bug for service workers where they
  // don't intercept the download request otherwise (see https://issues.chromium.org/issues/40410035). Firefox does not have
  // the same problem, so we always set the download attribute for Firefox. SiS is using a service worker, so without this logic
  // download requests wouldn't work right now.
  const downloadBaseUrl = window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL
  if (
    !downloadBaseUrl ||
    !url.startsWith(downloadBaseUrl) ||
    window.navigator.userAgent.includes("Firefox")
  ) {
    link.setAttribute("download", filename)
  }

  return link
}

export default createDownloadLinkElement
