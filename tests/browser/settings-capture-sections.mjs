import { openSession, go, output, seedAccount } from "./settings-session.mjs";

await seedAccount();
const { page, browser, context, evidence } = await openSession();
await page.setViewportSize({ width: 1440, height: 900 });
const routes = [
  "account",
  "privacy",
  "security",
  "notifications",
  "content",
  "appearance",
  "accessibility",
  "language",
  "data",
  "delete",
];
for (const theme of ["dark", "light"]) {
  await go(page, "appearance");
  await page
    .getByRole("button", {
      name: theme === "dark" ? /Dark A softer glow/ : /Light A fresh start/,
    })
    .click();
  for (const route of routes) {
    await go(page, route);
    await page.screenshot({
      path: `${output}/final-${theme}-${route}.png`,
      fullPage: true,
    });
  }
}
await context.close();
await browser.close();
console.log(
  JSON.stringify(
    {
      screenshots: routes.length * 2,
      routes,
      console: evidence.console,
      exceptions: evidence.exceptions,
      failedRequests: evidence.failedRequests,
      blocked: evidence.blocked,
    },
    null,
    2,
  ),
);
