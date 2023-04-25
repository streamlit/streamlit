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

import React, { ReactElement } from "react"
import { DocString as DocStringProto, IMember } from "src/lib/proto"
import {
  StyledDocContainer,
  StyledDocHeader,
  StyledDocName,
  StyledDocString,
  StyledDocSummary,
  StyledDocType,
  StyledDocValue,
  StyledMembersSummaryCell,
  StyledMembersDetailsCell,
  StyledMembersRow,
  StyledMembersTable,
} from "./styled-components"

export interface DocStringProps {
  width: number
  element: DocStringProto
}

/**
 * Functional element representing formatted text.
 */
export default function DocString({
  width,
  element,
}: DocStringProps): ReactElement {
  const { name, type, value, docString, members } = element

  // Put it all together into a nice little html view.
  return (
    <StyledDocContainer width={width} data-testid="stDocstring">
      <StyledDocHeader>
        <StyledDocSummary>
          {name ? <StyledDocName>{name}</StyledDocName> : null}
          {type ? <StyledDocType>{type}</StyledDocType> : null}
          {value ? <StyledDocValue>{value}</StyledDocValue> : null}
        </StyledDocSummary>
      </StyledDocHeader>
      <StyledDocString>{docString || "No docs available"}</StyledDocString>
      {members.length > 0 ? (
        <StyledMembersTable>
          {members.map(member => (
            <Member member={member} key={member.name} />
          ))}
        </StyledMembersTable>
      ) : null}
    </StyledDocContainer>
  )
}

interface MemberProps {
  member: IMember
}

// Exported for tests.
export function Member({ member }: MemberProps): ReactElement {
  const { name, type, value, docString } = member

  return (
    <StyledMembersRow>
      <StyledMembersSummaryCell>
        {name ? <StyledDocName>{name}</StyledDocName> : null}
        {type ? <StyledDocType>{type}</StyledDocType> : null}
      </StyledMembersSummaryCell>

      <StyledMembersDetailsCell>
        {value ? (
          <StyledDocValue>{value}</StyledDocValue>
        ) : (
          <StyledDocValue>{docString || "No docs available"}</StyledDocValue>
        )}
      </StyledMembersDetailsCell>
    </StyledMembersRow>
  )
}
