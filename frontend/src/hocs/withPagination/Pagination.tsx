import React from "react"
import Button, { Kind } from "components/shared/Button"
import { MaterialIcon } from "components/shared/Icon"
import { Small } from "components/shared/TextElements"
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
          <MaterialIcon icon="chevron_left" />
        </Button>
        <Button onClick={onNext} kind={Kind.MINIMAL}>
          <MaterialIcon icon="chevron_right" />
        </Button>
      </StyledPaginators>
    </StyledPagination>
  )
}

export default Pagination
