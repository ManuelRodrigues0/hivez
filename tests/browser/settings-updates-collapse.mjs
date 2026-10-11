import { openSession, origin, output, seedAccount } from "./settings-session.mjs";
import fs from "node:fs/promises";

await seedAccount();
const { page, browser, context, evidence } = await openSession();
await page.setViewportSize({ width: 1440, height: 900 });

async function drawerState() {
  return page.locator("#community-updates-drawer").evaluate((el) => ({
    visible: getComputedStyle(el).display !== "none",
    width: Math.round(el.getBoundingClientRect().width),
    rightReservation: getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--layout-right").trim(),
  }));
}

async function settingsThemeTokens() {
  return page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    const settings = document.querySelector(".hivez-settings");
    if (!shell || !settings) return null;
    const shellStyle = getComputedStyle(shell);
    const settingsStyle = getComputedStyle(settings);
    return {
      siteBackground: shellStyle.getPropertyValue("--hivez-bg").trim(),
      settingsBackground: settingsStyle.getPropertyValue("--st-bg").trim(),
      siteSurface: shellStyle.getPropertyValue("--hivez-surface-solid").trim(),
      settingsSurface: settingsStyle.getPropertyValue("--st-panel").trim(),
      siteText: shellStyle.getPropertyValue("--hivez-text").trim(),
      settingsText: settingsStyle.getPropertyValue("--st-text").trim(),
      siteAccent: shellStyle.getPropertyValue("--hivez-accent").trim(),
      settingsAccent: settingsStyle.getPropertyValue("--st-accent").trim(),
      settingsSidebarScrollbar: getComputedStyle(document.querySelector(".settings-sidebar")).scrollbarWidth,
    };
  });
}

const closedByDefault = await drawerState();
if (closedByDefault.visible || closedByDefault.rightReservation !== "0px") {
  throw new Error("Updates drawer should start closed without reserving content width");
}
await page.screenshot({ path: `${output}/updates-closed-settings.png`, fullPage: true });

await page.getByRole("button", { name: "Open community updates" }).click();
await page.locator("#community-updates-drawer").getByRole("button", { name: "Close community updates" }).waitFor();
const opened = await drawerState();
if (!opened.visible || opened.width !== 384 || opened.rightReservation !== "384px") {
  throw new Error("Desktop Updates should open while reserving its width in the page layout");
}
const updatesSurface = await page.evaluate(() => {
  const drawer = document.querySelector("#community-updates-drawer");
  const panel = drawer?.querySelector(".app-updates-panel");
  if (!drawer || !panel) return null;
  const drawerStyle = getComputedStyle(drawer);
  const panelStyle = getComputedStyle(panel);
  return {
    drawerShadow: drawerStyle.boxShadow,
    panelShadow: panelStyle.boxShadow,
    panelBorder: panelStyle.borderWidth,
    panelRadius: panelStyle.borderRadius,
    panelBackground: panelStyle.backgroundColor,
  };
});
if (!updatesSurface || updatesSurface.drawerShadow !== "none" || updatesSurface.panelShadow !== "none" || updatesSurface.panelBorder !== "0px" || updatesSurface.panelRadius !== "0px") {
  throw new Error(`Updates should use a flat, shadow-free activity surface: ${JSON.stringify(updatesSurface)}`);
}
await page.screenshot({ path: `${output}/updates-drawer-open.png`, fullPage: false });

await page.keyboard.press("Escape");
await page.waitForFunction(() => getComputedStyle(document.querySelector("#community-updates-drawer")).display === "none");
const escapeFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
if (escapeFocus !== "Open community updates") throw new Error("Escape should close Updates and restore focus to its trigger");

const routeResults = [];
let settingsTopGap = null;
for (const route of ["/", "/search", "/map", "/settings", "/settings/account", "/settings/privacy", "/settings/appearance"]) {
  await page.goto(`${origin}${route}`);
  const state = await drawerState();
  if (state.visible || state.rightReservation !== "0px") throw new Error(`Updates should remain closed without a reserved rail on ${route}`);
  if (route === "/settings") {
    await page.getByRole("heading", { name: "Your hive. Your way." }).waitFor();
    settingsTopGap = await page.evaluate(() => {
      const brand = document.querySelector(".settings-brand");
      const toolbar = document.querySelector(".settings-toolbar");
      const sidebar = document.querySelector(".settings-sidebar");
      if (!brand || !toolbar || !sidebar) return null;
      const hasOverflow = sidebar.scrollHeight > sidebar.clientHeight;
      sidebar.scrollTop = 120;
      const remainsScrollable = sidebar.scrollTop > 0;
      sidebar.scrollTop = 0;
      return {
        brandTop: brand.getBoundingClientRect().top,
        toolbarBottom: toolbar.getBoundingClientRect().bottom,
        aligned: brand.getBoundingClientRect().top < toolbar.getBoundingClientRect().bottom,
        scrollbarWidth: getComputedStyle(sidebar).scrollbarWidth,
        hasOverflow,
        remainsScrollable,
      };
    });
    if (!settingsTopGap?.aligned || settingsTopGap.scrollbarWidth !== "none" || !settingsTopGap.hasOverflow || !settingsTopGap.remainsScrollable) {
      throw new Error("Settings top alignment or invisible navigation scrollbar failed");
    }
    await page.getByRole("button", { name: "Open community updates" }).click();
    const settingsReflow = await page.evaluate(() => {
      const welcome = document.querySelector(".settings-welcome");
      const drawer = document.querySelector("#community-updates-drawer");
      if (!welcome || !drawer) return null;
      const box = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return rect ? { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) } : null;
      };
      return {
        welcomeRight: Math.round(welcome.getBoundingClientRect().right),
        drawerLeft: Math.round(drawer.getBoundingClientRect().left),
        reservedWidth: getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--layout-right").trim(),
        viewport: innerWidth,
        main: box(".app-main"),
        feed: box(".app-feed-shell"),
        settings: box(".hivez-settings"),
      };
    });
    if (!settingsReflow || settingsReflow.welcomeRight > settingsReflow.drawerLeft || settingsReflow.reservedWidth !== "384px") {
      throw new Error(`Settings content overlaps the open Updates panel: ${JSON.stringify(settingsReflow)}`);
    }
    await page.locator("#community-updates-drawer").getByRole("button", { name: "Close community updates" }).click();
    routeResults.push({ route, ...state, settingsReflow });
    await page.screenshot({ path: `${output}/updates-closed-settings.png`, fullPage: true });
    continue;
  }
  routeResults.push({ route, ...state });
}

const darkTokens = await settingsThemeTokens();
await page.getByRole("button", { name: /Light A fresh start/ }).click();
const lightTokens = await settingsThemeTokens();
await page.screenshot({ path: `${output}/settings-light-shared-theme.png`, fullPage: true });
await page.getByRole("button", { name: /Dark A softer glow/ }).click();
const darkRestored = await settingsThemeTokens();

await page.setViewportSize({ width: 1024, height: 768 });
await page.getByRole("button", { name: "Open community updates" }).click();
const tabletDrawer = await drawerState();
if (tabletDrawer.rightReservation !== "384px") throw new Error("Tablet desktop layout should reserve the Updates rail");
await page.locator("#community-updates-drawer").getByRole("button", { name: "Close community updates" }).click();

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Open community updates" }).click();
const mobileDrawer = await drawerState();
if (mobileDrawer.rightReservation !== "0px") throw new Error("Mobile Updates should remain an overlay without reserving desktop width");
const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
await page.locator("#community-updates-drawer").getByRole("button", { name: "Close community updates" }).click();

const summary = {
  closedByDefault,
  opened,
  updatesSurface,
  escapeFocus,
  routeResults,
  settingsTopGap,
  darkTokens,
  lightTokens,
  darkRestored,
  tabletDrawer,
  mobileDrawer,
  noOverflow,
  console: evidence.console.filter((item) => !item.text.includes("net::ERR_BLOCKED_BY_CLIENT.Inspector")),
  exceptions: evidence.exceptions,
  failedRequests: evidence.failedRequests.filter((item) => item.reason !== "net::ERR_BLOCKED_BY_CLIENT.Inspector"),
  blockedMapTiles: evidence.blocked.filter((item) => item.url.startsWith("https://tile.openstreetmap.org/")).length,
};

await fs.writeFile(`${output}/updates-collapse-review.json`, JSON.stringify(summary, null, 2));
await context.close();
await browser.close();
console.log(JSON.stringify(summary, null, 2));
