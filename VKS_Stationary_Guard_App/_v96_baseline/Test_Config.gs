/**
 * Test script to verify Guard App can read the Patrol Dashboard Config
 */
function test_readSiteConfig() {
    try {
        console.log("Attempting to read Site_Config from Patrol Dashboard...");
        const configs = getTableData('Site_Config'); // Uses Database.js logic

        console.log(`Found ${configs.length} config rows.`);

        if (configs.length > 0) {
            console.log("First config row:", JSON.stringify(configs[0]));

            // Test matching for VKS-A-001
            const targetCode = 'VKS-A-001';
            const targetId = 'VKS25-061'; // From user logs

            const match = configs.find(c =>
                String(c.code || '').toUpperCase() === targetCode ||
                String(c.code || '').toUpperCase() === targetId ||
                String(c.siteId) === targetId
            );

            if (match) {
                console.log("SUCCESS! Found config for VKS-A-001:");
                console.log(`- Rounds: ${match.rounds}`);
                console.log(`- Checkpoints: ${match.checkpoints}`);
            } else {
                console.warn("WARNING: Config found but VKS-A-001 not matched.");
            }

        } else {
            console.warn("WARNING: Site_Config table is empty or could not be read.");
        }

    } catch (e) {
        console.error("ERROR reading config: " + e.message);
    }
}
