import { checkAndTriggerAutomations } from '../AutomationService';

describe('checkAndTriggerAutomations', () => {
    test('logic moved to Cloud Function, runs without error', async () => {
        await expect(checkAndTriggerAutomations('user123')).resolves.toBeUndefined();
    });
});
