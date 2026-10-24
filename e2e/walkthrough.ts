// Clicks through the guided demo in a real browser and saves a screenshot
// of each step. Run with the app on BASE_URL (default http://localhost:3000):
//   node e2e/walkthrough.ts [out-dir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "e2e/out";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: process.env.FRAME === "1" ? 1.5 : 2 });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

// FRAME=1 saves viewport frames scrolled to the part that matters (for the README);
// otherwise each step is saved as a full page.
const FRAME = process.env.FRAME === "1";
const shot = async (name: string, focus?: string | RegExp) => {
  await page.addStyleTag({ content: "header.sticky{position:static!important} nextjs-portal{display:none!important}" });
  if (FRAME && focus) {
    await page.getByText(focus).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !FRAME });
  console.log(`${OUT}/${name}.png`);
};
const click = async (name: string | RegExp) => {
  await page.getByRole("button", { name }).first().click();
};

async function run() {
await page.goto(BASE);
await shot("00-home");

await page.goto(`${BASE}/demo`);
await page.getByRole("button", { name: /Start over/ }).click();
await page.getByText(/Read all 7 documents/).waitFor();
await click(/Read all 7 documents/);
await page.getByText("All documents read").waitFor({ timeout: 120_000 });
await page.getByText(/Caught a document that was sent twice/).waitFor();
await shot("01-evidence", /Caught a document that was sent twice/);

await click(/Calculate embedded emissions/);
await page.getByText(/The EU importer saves/).waitFor();
await shot("02-calculate", /The EU importer saves/);

await click(/Hand to the verifier/);
await page.getByText(/Sign, then record/).waitFor();
await click(/Bribe the verifier/);
await page.getByText(/BelowPrecursorEmissions/).first().waitFor();
await click(/Sign as/);
await click(/Edit the number after/);
await page.getByText(/NotAccreditedVerifier/).first().waitFor();
await click(/Record as/);
await page.getByText(/Statement recorded on the ledger/).waitFor();
await shot("03-verify", /Try to cheat/);

await click(/Ship to EU buyers/);
await page.getByRole("button", { name: "Allocate", exact: true }).first().click();
await page.getByText("Passports issued").waitFor();
await page.getByRole("button", { name: "Allocate", exact: true }).first().click();
await page.getByText(/10,500 t/).first().waitFor();
await click(/Sell 170,000 t/);
await page.getByText(/ExceedsVerifiedQuantity/).first().waitFor();
await shot("04-ship", /Passports issued/);

await click(/Switch to the importer/);
await page.getByText(/passport valid/).first().waitFor();
await click(/Surrender in the 2026 CBAM declaration/);
await page.getByText(/declared as/).first().waitFor();
await click(/Declare the same allocation/);
await page.getByText(/AllocationNotOpen/).first().waitFor();
await shot("05-declare", /hot-rolled coil · MRN/);

await page.goto(`${BASE}/ledger`);
await page.getByText(/consumed/).first().waitFor();
await shot("06-ledger", /Public view/);

await page.goto(`${BASE}/verify`);
await click(/Load the example/);
await page.getByText(/valid · open/).waitFor();
await shot("07-verify", /CBAM embedded-emissions passport/);

// The same check against the registry on the public testnet, read through a public RPC node.
await click(/Check another/);
if (await page.getByRole("button", { name: /Example on Ethereum Sepolia/ }).count()) {
  await click(/Example on Ethereum Sepolia/);
  await page.getByText(/Checked against Ethereum Sepolia/).waitFor({ timeout: 60_000 });
  await page.getByText(/valid · open/).waitFor();
}

if (!FRAME) {
  await page.goto(`${BASE}/method`);
  await shot("08-method");
}

}

try {
  await run();
} catch (e) {
  errors.push(`flow: ${(e as Error).message.split("\n")[0]}`);
  await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true });
  console.log(`${OUT}/failure.png`);
}
console.log(errors.length ? `\n${errors.length} browser errors:\n${errors.join("\n")}` : "\nNo browser errors.");
await browser.close();
process.exit(errors.length ? 1 : 0);
