describe('Authentication Flow', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('should render the login screen correctly', () => {
        // Verify title and subtitle are present
        cy.contains('Uni-Event').should('be.visible');
        cy.contains('Sign in to manage and join events').should('be.visible');

        // Verify input fields are present
        cy.get('input[placeholder="Email"]').should('be.visible');
        cy.get('input[placeholder="Password"]').should('be.visible');

        // Verify button and links
        cy.contains('Sign In').should('be.visible');
        cy.contains('Continue with Google').should('be.visible');
        cy.contains("Don't have an account?").should('be.visible');

        // Find toggler using parent element instead of fragile leading-space text matching
        cy.contains("Don't have an account?").parent().contains('Sign Up').should('be.visible');
    });

    it('should toggle between Sign In and Sign Up views', () => {
        // Click Sign Up link via parent element selector
        cy.contains("Don't have an account?").parent().contains('Sign Up').click();

        // Verify view has switched to Sign Up
        cy.contains('Create Account').should('be.visible');
        cy.contains('Sign Up').should('be.visible');
        cy.contains('Already have an account?').should('be.visible');
        cy.contains('Already have an account?').parent().contains('Login').should('be.visible');

        // Click Login link to switch back
        cy.contains('Already have an account?').parent().contains('Login').click();

        // Verify switched back to Sign In
        cy.contains('Sign In').should('be.visible');
    });

    it('should toggle password visibility when clicking eye icon', () => {
        // Type password
        cy.get('input[placeholder="Password"]')
            .should('have.attr', 'type', 'password')
            .type('secret123');

        // Click eye icon using standard web aria-label attribute instead of accessibilitylabel
        cy.get('[aria-label="Show password"]').click();

        // Verify password is now visible
        cy.get('input[placeholder="Password"]').should('have.attr', 'type', 'text');

        // Click again to hide
        cy.get('[aria-label="Hide password"]').click();

        // Verify password is hidden again
        cy.get('input[placeholder="Password"]').should('have.attr', 'type', 'password');
    });
});
