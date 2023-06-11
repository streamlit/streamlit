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

import React, { ReactElement, ReactNode, useEffect, useRef } from "react"
import { StyledChatContainer, StyledChatAnchor } from "./styled-components"

export interface Props {
  children?: ReactNode
}

// function useOnScreen(ref: RefObject<HTMLElement>) {
//   const [isIntersecting, setIntersecting] = useState(false)

//   const observer = useMemo(
//     () =>
//       new IntersectionObserver(([entry]) =>
//         setIntersecting(entry.isIntersecting)
//       ),
//     [ref]
//   )

//   useEffect(() => {
//     if (ref.current) {
//       observer.observe(ref.current)
//       return () => observer.disconnect()
//     }
//   }, [])

//   return isIntersecting
// }

function ChatContainer(props: Props): ReactElement {
  const { children } = props
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  // const isVisible = useOnScreen(scrollAnchorRef)

  const scrollArea = document.getElementsByClassName("main")[0]
  const isOnBottom =
    Math.abs(
      scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight
    ) < 1

  useEffect(() => {
    // use useLayoutEffect instead here?
    if (isOnBottom) {
      scrollAnchorRef.current?.scrollIntoView()
    }
  }, [children])

  //
  // if (scrollArea) {
  //   const observer = new MutationObserver(function () {
  //     scrollArea.scrollTop = scrollArea.scrollHeight
  //   })

  //   observer.observe(scrollArea, { childList: true })
  // }

  return (
    <StyledChatContainer>
      {children}
      <StyledChatAnchor ref={scrollAnchorRef} />
    </StyledChatContainer>
  )
}

export default ChatContainer
