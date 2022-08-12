describe("kill server", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("disconnects the client", () => {
    cy.get("[data-testid='stConnectionStatus']").should("not.exist");

    cy.window().then(win => {
      win.streamlitDebug.closeConnection();

      cy.get("[data-testid='stConnectionStatus'] label").should(
        "have.text",
        "Connecting"
      );

      // Snapshot `stToolbar` instead of `ConnectionStatus` so we have a larger
      // bounding box and a lower percentage difference on the snapshot diff
      cy.get("[data-testid='stToolbar']").matchThemedSnapshots("disconnected");
    });
  });
});
