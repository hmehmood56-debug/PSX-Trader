import { chromium } from "playwright";

const TARGET_URL = "https://www.nccpl.com.pk/market-information";

async function main() {
  const launchModes = [false, true];

  for (const headless of launchModes) {
    const modeLabel = headless ? "headless fallback" : "headed (preferred)";
    let browser;

    try {
      console.log(`Launching Chromium in ${modeLabel} mode...`);
      browser = await chromium.launch({ headless });
      const page = await browser.newPage();

      console.log(`Opening: ${TARGET_URL}`);
      await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 120000 });

      // Small extra delay to allow late hydration/content settling.
      await page.waitForTimeout(2000);

      const title = await page.title();
      const tableCount = await page.locator("table").count();
      const bodyText = await page.locator("body").innerText();
      const bodySnippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 500);

      console.log(`Page title: ${title}`);
      console.log(`Table count: ${tableCount}`);
      console.log("Body text preview (first ~500 chars):");
      console.log(bodySnippet);
      return;
    } catch (error) {
      console.error(`Run failed in ${modeLabel} mode:`, error.message || error);
      if (headless) throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exitCode = 1;
});
