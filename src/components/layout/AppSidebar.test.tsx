import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { renderWithProviders } from "@/test/test-utils";

describe("AppSidebar", () => {
  it("renders LLM Overview in the root category and marks it selected on /models/overview", () => {
    renderWithProviders(<AppSidebar />, { route: "/models/overview" });

    const llmOverviewLink = screen.getByRole("link", { name: /llm overview/i });
    expect(llmOverviewLink).toBeInTheDocument();

    const menuItem = llmOverviewLink.closest(".ant-menu-item");
    expect(menuItem).toHaveClass("ant-menu-item-selected");
  });
});
