describe('Critical Event App Flows', () => {
    beforeEach(() => {
        cy.visit('/');
        // Set mock user session using our Cypress hook
        cy.window().then(win => {
            win.setMockUser(
                {
                    uid: 'student-test-uid',
                    displayName: 'Jane Doe',
                    email: 'jane.doe@uni.edu',
                },
                'student',
                {
                    name: 'Jane Doe',
                    email: 'jane.doe@uni.edu',
                    branch: 'Computer Science',
                    year: '3rd Year',
                    points: 120,
                },
            );
        });
    });

    it('should render the event feed home page correctly', () => {
        // Verify welcome text is loaded from the mock user displayName
        cy.contains('Welcome,').should('be.visible');
        cy.contains('Jane Doe').should('be.visible');

        // Verify search bar is visible
        cy.get('input[placeholder="Search events..."]').should('be.visible');

        // Verify recommendations section header is visible
        cy.contains('RECOMMENDED FOR YOU').should('be.visible');
    });

    it('should support tab navigation to Leaderboard and Profile', () => {
        // We should be able to navigate to Leaderboard using tab bar
        cy.contains('Rankings').click();

        // Verify Leaderboard screen is shown
        cy.contains('LEADERBOARD').should('be.visible');
        cy.contains('Top Contributors').should('be.visible');

        // Navigate to Profile using tab bar
        cy.contains('Profile').click();

        // Verify Profile screen renders correctly
        cy.contains('Jane Doe').should('be.visible');
        cy.contains('jane.doe@uni.edu').should('be.visible');
        cy.contains('Computer Science').should('be.visible');
        cy.contains('3rd Year').should('be.visible');
        cy.contains('Student Settings').should('be.visible');
    });

    it('should allow searching for events in the feed', () => {
        const searchQuery = 'Hackathon';
        // Type search query
        cy.get('input[placeholder="Search events..."]')
            .type(searchQuery)
            .should('have.value', searchQuery);

        // Verify close icon appears via stable testID
        cy.get('[data-testid="clear-search-button"]').should('exist');
    });
});
