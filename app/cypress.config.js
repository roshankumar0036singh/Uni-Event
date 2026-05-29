const { defineConfig } = require('cypress');

module.exports = defineConfig({
    e2e: {
        baseUrl: 'http://localhost:19006',
        supportFile: false,
        specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
        video: true,
        screenshotOnRunFailure: true,
        defaultCommandTimeout: 10000,
        viewportWidth: 1280,
        viewportHeight: 720,
    },
});
