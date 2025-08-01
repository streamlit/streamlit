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

import { useCallback, useContext } from "react"

import { LibContext } from "~lib/components/core/LibContext"
import createDownloadLinkElement from "~lib/util/createDownloadLinkElement"

const useDownloadUrl = (
  url: string | null,
  filename: string
): (() => void) => {
  const {
    libConfig: {
      enforceDownloadInNewTab = false, // Default to false, if no libConfig, e.g. for tests
    },
  } = useContext(LibContext)

  const downloadUrl = useCallback(() => {
    if (!url) return

    const link = createDownloadLinkElement({
      enforceDownloadInNewTab,
      url,
      filename,
    })

    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [url, enforceDownloadInNewTab, filename])

  return downloadUrl
}

export default useDownloadUrl
