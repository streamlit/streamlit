describe("st.map", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("loads the main streamlit_app script on initial page load", () => {
    cy.get(".element-container .stMarkdown h2").should("contain", "Main Page");
  });

  it("renders the SidebarNav correctly", () => {
    cy.prepForElementSnapshots();

    cy.get("[data-testid='stSidebarNav']").matchThemedSnapshots(
      "multipage-apps-sidebar-nav"
    );
  });

  it("can switch between pages by clicking on the SidebarNav links", () => {
    cy.getIndexed('[data-testid="stSidebarNav"] a', 1).click();

    cy.get(".element-container .stMarkdown h2").should("contain", "Page 2");
  });

  it("supports navigating to a page directly via URL", () => {
    cy.loadApp("http://localhost:3000/page2");
    cy.get(".element-container .stMarkdown h2").should("contain", "Page 2");
  });

  it("can switch between pages and edit widgets", () => {
    cy.getIndexed('[data-testid="stSidebarNav"] a', 2).click();

    cy.get(".element-container .stMarkdown h2").should("contain", "Page 3");

    cy.get(".element-container .stMarkdown p").should("contain", "x is 0");

    cy.get('.stSlider [role="slider"]')
      .click()
      .type("{rightarrow}", { force: true });

    cy.get(".element-container .stMarkdown p").should("contain", "x is 1");
  });

  it("can switch to the first page with a duplicate name", () => {
    cy.getIndexed('[data-testid="stSidebarNav"] a', 3).click();

    cy.get(".element-container .stMarkdown h2").should("contain", "Page 4");
  });

  it("can switch to the second page with a duplicate name", () => {
    cy.getIndexed('[data-testid="stSidebarNav"] a', 4).click();

    cy.get(".element-container .stMarkdown h2").should("contain", "Page 5");
  });

  it("runs the first page with a duplicate name if navigating via URL", () => {
    cy.loadApp("http://localhost:3000/page_with_duplicate_name");
    cy.get(".element-container .stMarkdown h2").should("contain", "Page 4");
  });

  it("serves the react app and displays the page not found modal if the page does not exist", () => {
    cy.loadApp("http://localhost:3000/not_a_page");

    cy.get('[role="dialog"]').should("contain", "Page not found");
  });
});
