describe("st.set_page_config", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("sets the page favicon", () => {
    cy.get("link[rel='shortcut icon']")
      .invoke("attr", "href")
      .should("eq", "https://twemoji.maxcdn.com/2/72x72/1f988.png");
  });

  it("sets the page title", () => {
    cy.title().should("eq", "Heya, world?");
  });

  it("collapses the sidebar", () => {
    cy.get("[data-testid='stSidebar']").should(
      "have.attr",
      "aria-expanded",
      "false"
    );
  });

  it("sets the page in wide mode", () => {
    cy.get("[data-testid='stAppViewContainer']").should(
      "have.attr",
      "data-layout",
      "wide"
    );
  });

  it("displays in wide mode", () => {
    cy.get("[data-testid='stAppViewContainer']").matchThemedSnapshots(
      "wide-mode"
    );
  });

  describe("double-setting set_page_config", () => {
    beforeEach(() => {
      // Rerun the script to ensure a fresh slate.
      // This is done by typing r on the page
      cy.get("body").type("r");
      // Ensure the rerun completes
      cy.wait(1000);
    });

    it("should not display an error when st.set_page_config is used after an st.* command in a callback", () => {
      cy.getIndexed(".stButton button", 1).click();

      cy.get(".stException").should("not.exist");
      cy.title().should("eq", "Heya, world?");
    });

    it("should display an error when st.set_page_config is called multiple times in a callback", () => {
      cy.getIndexed(".stButton button", 2).click();

      cy.get(".stException")
        .contains("set_page_config() can only be called once per app")
        .should("exist");
      // Ensure that the first set_page_config worked
      cy.title().should("eq", "Change 1");
    });

    it("should display an error when st.set_page_config is called after being called in a callback", () => {
      cy.getIndexed(".stButton button", 3).click();

      cy.get(".stException")
        .contains("set_page_config() can only be called once per app")
        .should("exist");
      // Ensure that the first set_page_config worked
      cy.title().should("eq", "Change 3");
    });
  });
});
