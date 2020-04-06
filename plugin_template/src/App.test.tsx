import React from "react";
import { render } from "@testing-library/react";
import Plugin from "./App";

test("renders learn react link", () => {
  const { getByText } = render(<Plugin />);
  const linkElement = getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
