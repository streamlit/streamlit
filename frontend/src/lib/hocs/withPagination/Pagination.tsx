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

import React from "react"
import { ChevronLeft, ChevronRight } from "@emotion-icons/material-outlined"
import Button, { Kind } from "src/lib/components/shared/Button"
import Icon from "src/lib/components/shared/Icon"
import { Small } from "src/lib/components/shared/TextElements"
import { StyledPagination, StyledPaginators } from "./styled-components"

export interface Props {
  className: string
  currentPage: number
  totalPages: number
  pageSize: number
  onNext: (event: React.SyntheticEvent<HTMLElement>) => void
  onPrevious: (event: React.SyntheticEvent<HTMLElement>) => void
}

const Pagination = ({
  className,
  currentPage,
  totalPages,
  onNext,
  onPrevious,
}: Props): React.ReactElement => {
  return (
    <StyledPagination className={className}>
      <Small>{`Showing page ${currentPage} of ${totalPages}`}</Small>
      <StyledPaginators>
        <Button onClick={onPrevious} kind={Kind.MINIMAL}>
          <Icon content={ChevronLeft} size="xl" />
        </Button>
        <Button onClick={onNext} kind={Kind.MINIMAL}>
          <Icon content={ChevronRight} size="xl" />
        </Button>
      </StyledPaginators>
    </StyledPagination>
  )
}

export default Pagination
