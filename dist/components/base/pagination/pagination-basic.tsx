"use client";

import { Pagination } from "@heroui/react";
import { useState } from "react";

export interface PaginationBasicProps {
  totalPages?: number;
  initialPage?: number;
  onChange?: (page: number) => void;
  className?: string;
}

export function PaginationBasic({
  totalPages = 3,
  initialPage = 1,
  onChange,
  className = "justify-center"
}: PaginationBasicProps) {
  const [page, setPage] = useState(initialPage);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (onChange) {
      onChange(newPage);
    }
  };

  return (
    <Pagination className={className}>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={page === 1}
            onPress={() => handlePageChange(Math.max(1, page - 1))}
          >
            <Pagination.PreviousIcon />
            <span>Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <Pagination.Item key={p}>
            <Pagination.Link
              isActive={p === page}
              onPress={() => handlePageChange(p)}
            >
              {p}
            </Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next
            isDisabled={page === totalPages}
            onPress={() => handlePageChange(Math.min(totalPages, page + 1))}
          >
            <span>Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

export default PaginationBasic;
