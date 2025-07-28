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

import React, { memo, ReactElement } from "react"

import { DocString as DocStringProto, IMember } from "@streamlit/protobuf"

import {
  StyledDocContainer,
  StyledDocHeader,
  StyledDocName,
  StyledDocString,
  StyledDocSummary,
  StyledDocType,
  StyledDocValue,
  StyledMembersDetailsCell,
  StyledMembersRow,
  StyledMembersSummaryCell,
  StyledMembersTable,
} from "./styled-components"

export interface DocStringProps {
  element: DocStringProto
}

/**
 * Functional element representing formatted text.
 */
function DocString({ element }: DocStringProps): ReactElement {
  const { name, type, value, docString, members } = element

  // Put it all together into a nice little html view.
  return (
    <StyledDocContainer className="stHelp" data-testid="stHelp">
      <StyledDocHeader>
        <StyledDocSummary>
          {name ? (
            <StyledDocName data-testid="stHelpName">{name}</StyledDocName>
          ) : null}
          {type ? (
            <StyledDocType data-testid="stHelpType">{type}</StyledDocType>
          ) : null}
          {value ? (
            <StyledDocValue data-testid="stHelpValue">{value}</StyledDocValue>
          ) : null}
        </StyledDocSummary>
      </StyledDocHeader>
      <StyledDocString data-testid="stHelpDoc">
        {docString || "No docs available"}
      </StyledDocString>
      {members.length > 0 ? (
        <StyledMembersTable data-testid="stHelpMembersTable">
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
    <StyledMembersRow data-testid="stHelpMember">
      <StyledMembersSummaryCell>
        {name ? (
          <StyledDocName data-testid="stHelpMemberDocName">
            {name}
          </StyledDocName>
        ) : null}
        {type ? (
          <StyledDocType data-testid="stHelpMemberDocType">
            {type}
          </StyledDocType>
        ) : null}
      </StyledMembersSummaryCell>

      <StyledMembersDetailsCell>
        {value ? (
          <StyledDocValue data-testid="stHelpMemberDocValue">
            {value}
          </StyledDocValue>
        ) : (
          <StyledDocValue data-testid="stHelpMemberDocString">
            {docString || "No docs available"}
          </StyledDocValue>
        )}
      </StyledMembersDetailsCell>
    </StyledMembersRow>
  )
}

export default memo(DocString)
