import React from "react"
import { ChevronLeft, ChevronRight } from "@emotion-icons/material-outlined"
import Button, { Kind } from "src/components/shared/Button"
import Icon from "src/components/shared/Icon"
import { Small } from "src/components/shared/TextElements"
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
