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

import { useCallback, useEffect, useState } from "react"
import type { MessageQueue } from "../lib/MessageQueue"
import type {
  AppPage,
  IAppPage,
  PageInfo,
  PageNotFound,
  NewSession,
  PagesChanged,
} from "../../../proto"
import type { BaseUriParts } from "../../../util/UriUtil"
import { type AppUrl, type StreamlitAppPage } from "../stores/AppUrlContext"

export function extractPageNameFromPathName(
  pathname: string,
  basePath: string
): string {
  // We'd prefer to write something like
  //
  // ```
  // replace(
  //   new RegExp(`^/${basePath}/?`),
  //   ""
  // )
  // ```
  //
  // below, but that doesn't work because basePath may contain unescaped
  // regex special-characters. This is why we're stuck with the
  // weird-looking triple `replace()`.
  return decodeURIComponent(
    pathname.replace(`/${basePath}`, "").replace(/^\/?/, "").replace(/\/$/, "")
  )
}

const toStreamlitAppPage = (appPage: IAppPage): StreamlitAppPage => ({
  pageName: appPage.pageName ?? "",
  pageScriptHash: appPage.pageScriptHash ?? "",
  icon: appPage.icon ?? undefined,
})

export function useAppUrlManager(
  messageQueue: MessageQueue,
  endpoint: BaseUriParts | null
): AppUrl {
  const [currentPageScriptHash, setCurrentPageScriptHash] =
    useState<string>("")
  const [queryParams, setQueryParams] = useState<URLSearchParams>(
    new URLSearchParams(document.location.search)
  )
  const [appPages, setAppPages] = useState<StreamlitAppPage[]>([])
  const queryString = queryParams.toString()

  const handleNewSession = useCallback(
    (session: NewSession) => {
      setCurrentPageScriptHash(session.pageScriptHash)
      setAppPages(session.appPages.map(toStreamlitAppPage))

      // mainPage must be a string as we're guaranteed at this point that
      // newSessionProto.appPages is nonempty and has a truthy pageName.
      // Otherwise, we'd either have no main script or a nameless main script,
      // neither of which can happen.
      const mainPage = session.appPages[0] as AppPage
      // We're similarly guaranteed that newPageName will be found / truthy
      // here.
      const newPage = session.appPages.find(
        p => p.pageScriptHash === session.pageScriptHash
      )
      const newPageName = newPage?.pageName
      const viewingMainPage = mainPage === newPage

      if (endpoint) {
        const { basePath } = endpoint

        const prevPageNameInPath = extractPageNameFromPathName(
          document.location.pathname,
          basePath
        )
        const prevPageName =
          prevPageNameInPath === "" ? mainPage.pageName : prevPageNameInPath
        // It is important to compare `newPageName` with the previous one encoded in the URL
        // to handle new session runs triggered by URL changes through the `onHistoryChange()` callback,
        // e.g. the case where the user clicks the back button.
        // See https://github.com/streamlit/streamlit/pull/6271#issuecomment-1465090690 for the discussion.
        if (prevPageName !== newPageName) {
          const qs = queryString ? `?${queryString}` : ""
          const basePathPrefix = basePath ? `/${basePath}` : ""

          const pagePath = viewingMainPage ? "" : newPageName
          const pageUrl = `${basePathPrefix}/${pagePath}${qs}`

          window.history.pushState({}, "", pageUrl)
        }
      }
    },
    [endpoint, queryString]
  )

  const handlePageInfoChanged = useCallback((pageInfo: PageInfo) => {
    const { queryString: pageInfoQueryString } = pageInfo
    const targetUrl =
      document.location.pathname +
      (pageInfoQueryString ? `?${pageInfoQueryString}` : "")
    window.history.pushState({}, "", targetUrl)
    setQueryParams(new URLSearchParams(pageInfoQueryString))

    // this.hostCommunicationMgr.sendMessageToHost({
    //   type: "SET_QUERY_PARAM",
    //   queryParams: queryString ? `?${queryString}` : "",
    // })
  }, [])

  const handlePagesChanged = useCallback(
    (pagesChangedMsg: PagesChanged): void => {
      const { appPages: msgAppPages } = pagesChangedMsg
      setAppPages(msgAppPages.map(toStreamlitAppPage))
    },
    []
  )

  const handlePageNotFound = useCallback((): void => {
    const pageScriptHash = appPages[0]?.pageScriptHash || ""
    setCurrentPageScriptHash(pageScriptHash)
  }, [appPages])

  useEffect(() => {
    return messageQueue.on<NewSession>("newSession", handleNewSession)
  }, [messageQueue, handleNewSession])

  useEffect(() => {
    return messageQueue.on<PageNotFound>("pageNotFound", handlePageNotFound)
  }, [messageQueue, handlePageNotFound])

  useEffect(() => {
    return messageQueue.on<PagesChanged>("pagesChanged", handlePagesChanged)
  }, [messageQueue, handlePagesChanged])

  useEffect(() => {
    return messageQueue.on<PageInfo>("pageInfoChanged", handlePageInfoChanged)
  }, [messageQueue, handlePageInfoChanged])

  return {
    currentPageScriptHash,
    appPages,
    queryParams,
  }
}
