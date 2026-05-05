/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement } from "react"

import { Help as HelpProto, IMember } from "@streamlit/protobuf"

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

export interface HelpProps {
  element: HelpProto
}

interface MemberProps {
  member: IMember
}

/** Renders a single member row in the members table. */
export const Member = memo(function Member({
  member,
}: MemberProps): ReactElement {
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
})

/** Functional element representing formatted text. */
function Help({ element }: HelpProps): ReactElement {
  const { name, type, value, docString, members } = element

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
          <tbody>
            {members.map(member => (
              <Member member={member} key={member.name} />
            ))}
          </tbody>
        </StyledMembersTable>
      ) : null}
    </StyledDocContainer>
  )
}

export default memo(Help)
