import { test, expect, type Page } from '@playwright/test';

// Helper: wait for the title screen to fully load (has the 200ms input delay)
async function waitForTitleScreen(page: Page): Promise<void> {
  await page.goto('/');
  // Wait for the title text to appear
  await page.locator('text=/závod|Race/').first().waitFor({ timeout: 15000 });
  // Wait a bit extra for the input delay (200ms) to finish
  await page.waitForTimeout(400);
}

// Helper: navigate from title through to the game screen
async function navigateToGame(page: Page): Promise<void> {
  await waitForTitleScreen(page);

  // Title -> Player Count
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Player Count: press "1"
  const onePlayerBtn = page.locator('button').filter({ hasText: /1/ }).first();
  await expect(onePlayerBtn).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('1');
  await page.waitForTimeout(500);

  // Track Select: click first track
  await page.locator('text=/[Vv]yber tra|[Ss]elect/').first().waitFor({ timeout: 5000 });
  // Press Enter to confirm the already-selected first track
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Character Select: confirm with Enter
  await page.locator('text=/[Vv]yber vozidlo|[Cc]hoose/').first().waitFor({ timeout: 5000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Wait for canvas to appear
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------
// 1. Title screen loads
// ---------------------------------------------------------------------------
test.describe('Title screen', () => {
  test('displays the title text', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('text=/závod|Race/');
    await expect(title.first()).toBeVisible({ timeout: 15000 });
  });

  test('displays "press any key" prompt', async ({ page }) => {
    await page.goto('/');
    const prompt = page.locator('text=/[Ss]tiskni|[Pp]ress/');
    await expect(prompt.first()).toBeVisible({ timeout: 15000 });
  });

  test('displays the language toggle button', async ({ page }) => {
    await page.goto('/');
    // Wait for title to load first
    await page.locator('text=/závod|Race/').first().waitFor({ timeout: 15000 });
    const langButton = page.locator('button').filter({ hasText: /^EN$|^CZ$/ });
    await expect(langButton).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Navigation flow
// ---------------------------------------------------------------------------
test.describe('Navigation flow', () => {
  test('title -> player count -> track select -> character select -> game', async ({
    page,
  }) => {
    await navigateToGame(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Canvas renders
// ---------------------------------------------------------------------------
test.describe('Canvas renders', () => {
  test('game canvas exists with correct dimensions after starting a game', async ({
    page,
  }) => {
    await navigateToGame(page);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const width = await canvas.getAttribute('width');
    const height = await canvas.getAttribute('height');
    // Canvas is dynamically sized to fill the viewport
    expect(Number(width)).toBeGreaterThan(0);
    expect(Number(height)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Language toggle
// ---------------------------------------------------------------------------
test.describe('Language toggle', () => {
  test('clicking language button switches text between Czech and English', async ({
    page,
  }) => {
    await page.goto('/');
    // Wait for title to load
    await page.locator('text=/závod|Race/').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);

    const langButton = page.locator('button').filter({ hasText: /^EN$|^CZ$/ });
    await expect(langButton).toBeVisible({ timeout: 5000 });

    // Get initial prompt text (Czech)
    const promptBefore = await page
      .locator('text=/[Ss]tiskni|[Pp]ress/')
      .first()
      .textContent();

    // Click language button (use force to avoid title screen click-to-advance)
    await langButton.click({ force: true });
    await page.waitForTimeout(300);

    // The button text should toggle
    const promptAfter = await page
      .locator('text=/[Ss]tiskni|[Pp]ress/')
      .first()
      .textContent();

    expect(promptBefore).not.toBe(promptAfter);
  });
});

// ---------------------------------------------------------------------------
// 5. Pause menu
// ---------------------------------------------------------------------------
test.describe('Pause menu', () => {
  test('pressing Escape during game shows pause menu with options', async ({
    page,
  }) => {
    await navigateToGame(page);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify pause overlay appears
    const pausedText = page.locator('text=/[Pp]auz|[Pp]ause/');
    await expect(pausedText.first()).toBeVisible({ timeout: 3000 });

    // Verify menu buttons exist
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('pressing Escape again unpauses the game', async ({ page }) => {
    await navigateToGame(page);

    // Pause
    await page.keyboard.press('Escape');
    const pausedText = page.locator('text=/[Pp]auz|[Pp]ause/');
    await expect(pausedText.first()).toBeVisible({ timeout: 3000 });

    // Unpause
    await page.keyboard.press('Escape');
    await expect(pausedText.first()).not.toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// 6. Screen transitions
// ---------------------------------------------------------------------------
test.describe('Screen transitions', () => {
  test('player count screen is reachable from title', async ({ page }) => {
    await waitForTitleScreen(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const option1 = page.locator('button').filter({ hasText: /1/ }).first();
    await expect(option1).toBeVisible({ timeout: 5000 });

    const option2 = page.locator('button').filter({ hasText: /2/ }).first();
    await expect(option2).toBeVisible({ timeout: 5000 });
  });

  test('track select screen shows all 3 tracks', async ({ page }) => {
    await waitForTitleScreen(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.locator('button').filter({ hasText: /1/ }).first().waitFor({ timeout: 5000 });
    await page.keyboard.press('1');
    await page.waitForTimeout(500);

    // Wait for track select header
    await page.locator('text=/[Vv]yber tra|[Ss]elect/').first().waitFor({ timeout: 5000 });

    // Count track buttons - they each contain a difficulty badge
    const trackButtons = page.locator('button').filter({
      has: page.locator('text=/[Ll]ehk|[Ss]třed|[Tt]ěžk|[Ee]asy|[Mm]edium|[Hh]ard/'),
    });
    const count = await trackButtons.count();
    expect(count).toBe(3);
  });

  test('character select screen shows 5 characters', async ({ page }) => {
    await waitForTitleScreen(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.locator('button').filter({ hasText: /1/ }).first().waitFor({ timeout: 5000 });
    await page.keyboard.press('1');
    await page.waitForTimeout(500);

    // Track select - confirm default
    await page.locator('text=/[Vv]yber tra|[Ss]elect/').first().waitFor({ timeout: 5000 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Character select - check for character names
    await page.locator('text=/[Vv]yber vozidlo|[Cc]hoose/').first().waitFor({ timeout: 5000 });

    // Each character is a button with an SVG icon inside
    const charButtons = page.locator('button').filter({ has: page.locator('svg') });
    const count = await charButtons.count();
    // 5 character buttons + possibly a back button (Esc) without SVG
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('quit from pause returns to title screen', async ({ page }) => {
    await navigateToGame(page);

    // Pause
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify pause is visible
    const pausedText = page.locator('text=/[Pp]auz|[Pp]ause/');
    await expect(pausedText.first()).toBeVisible({ timeout: 3000 });

    // Navigate to the Quit option using arrow keys and select it
    await page.keyboard.press('ArrowDown'); // -> Restart
    await page.keyboard.press('ArrowDown'); // -> Quit
    await page.keyboard.press('Enter');

    // Should be back at title screen (after transition)
    const titleText = page.locator('text=/závod|Race/');
    await expect(titleText.first()).toBeVisible({ timeout: 10000 });
  });
});
