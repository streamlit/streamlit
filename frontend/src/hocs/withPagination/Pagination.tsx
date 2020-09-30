import React from "react"
import { styled } from "styletron-react"

import Button, { Kind } from "components/shared/Button"
import { MaterialIcon } from "components/shared/Icon"
import { colors, spacingCalculator } from "lib/widgetTheme"
import { Small } from "components/shared/TextElements"

export interface Props {
  className: string
  currentPage: number
  totalPages: number
  pageSize: number
  onNext: (event: React.SyntheticEvent<HTMLElement>) => void
  onPrevious: (event: React.SyntheticEvent<HTMLElement>) => void
}

const StyledPagination = styled("div", {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: spacingCalculator(0.25),
  marginBottom: spacingCalculator(0.25),
})

const Paginators = styled("div", {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: colors.secondary,
})

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
      <Paginators>
        <Button onClick={onPrevious} kind={Kind.MINIMAL}>
          <MaterialIcon icon="chevron_left" />
        </Button>
        <Button onClick={onNext} kind={Kind.MINIMAL}>
          <MaterialIcon icon="chevron_right" />
        </Button>
      </Paginators>
    </StyledPagination>
  )
}

export default Pagination
