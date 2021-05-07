describe("video recording", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
    // Wait for an element to exist
    cy.get(".stSlider").should("exist");
  });

  it("displays recording indicator during recording", () => {
    cy.get("#MainMenu > button").click();
    cy.get("[data-testid='main-menu-list']")
      .contains("Record a screencast")
      .click();

    cy.get(".ModalBody")
      .contains("Start recording!")
      .click();

    // Wait for the countdown before starting the video recording.
    cy.get("[data-testid='recordingIndicator']", { timeout: 5000 }).should(
      "exist"
    );

    cy.get("#MainMenu > button").click();

    cy.get("[data-testid='main-menu-list']")
      .contains("Stop recording")
      .click();

    cy.get("[data-baseweb='modal'] [aria-label='Close']").click();

    cy.get("[data-testid='recordingIndicator']").should("not.exist");
  });
});
