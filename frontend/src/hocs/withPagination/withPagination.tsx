import React, { ComponentType, ReactElement, useEffect, useState } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"
import Pagination from "src/hocs/withPagination/Pagination"
import { usePrevious } from "src/lib/Hooks"

export interface Props {
  items: any[]
  pageSize: number
  resetOnAdd: boolean
}

const calculateNumPages = (items: any[], pageSize: number): number =>
  Math.ceil(items.length / pageSize)

const withPagination = (
  WrappedComponent: ComponentType<any>
): ComponentType<any> => {
  const WithPagination = ({
    pageSize,
    items,
    resetOnAdd,
    ...props
  }: Props): ReactElement => {
    const [currentPage, updateCurrentPage] = useState<number>(0)
    const [totalPages, updateTotalPages] = useState<number>(
      calculateNumPages(items, pageSize)
    )

    const prevItems: any[] = usePrevious(items)

    useEffect(() => {
      if (prevItems && prevItems.length !== items.length) {
        updateTotalPages(calculateNumPages(items, pageSize))
      }
      if (prevItems && prevItems.length < items.length) {
        if (resetOnAdd) {
          updateCurrentPage(0)
        }
      } else if (currentPage + 1 >= totalPages) {
        updateCurrentPage(totalPages - 1)
      }
    }, [items, currentPage, pageSize, prevItems, resetOnAdd, totalPages])

    const onNext = (): void => {
      updateCurrentPage(Math.min(currentPage + 1, totalPages - 1))
    }

    const onPrevious = (): void => {
      updateCurrentPage(Math.max(0, currentPage - 1))
    }

    const paginatedItems = items.slice(
      currentPage * pageSize,
      currentPage * pageSize + pageSize
    )
    return (
      <>
        <WrappedComponent items={paginatedItems} {...props} />
        {items.length > pageSize ? (
          <Pagination
            className="streamlit-paginator"
            pageSize={pageSize}
            totalPages={totalPages}
            currentPage={currentPage + 1}
            onNext={onNext}
            onPrevious={onPrevious}
          />
        ) : null}
      </>
    )
  }
  return hoistNonReactStatics(WithPagination, WrappedComponent)
}

export default withPagination
