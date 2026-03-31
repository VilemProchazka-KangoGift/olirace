import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: navigate through the menu flow all the way to the game screen.
// Returns once the canvas is visible.
// ---------------------------------------------------------------------------
async function navigateToGame(page: Page): Promise<void> {
  await page.goto('/');

  // Title screen -- wait for it and press a key
  await page.locator('text=/[Ss]tiskni|[Pp]ress/').first().waitFor({ timeout: 10000 });
  await page.keyboard.press('Enter');

  // Player count screen -- wait for buttons and press keyboard shortcut "1"
  const onePlayerBtn = page.locator('button', { hasText: '1' }).first();
  await expect(onePlayerBtn).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('1');

  // Track select screen -- wait for track header to appear
  const trackHeader = page.locator('text=/[Vv]yber tra|[Ss]elect [Tt]rack/');
  await expect(trackHeader.first()).toBeVisible({ timeout: 5000 });
  // Click the first track card by its Czech name
  const firstTrack = page.locator('button').filter({ hasText: /[Nn]ed|[Ss]unday/ }).first();
  await expect(firstTrack).toBeVisible({ timeout: 3000 });
  await firstTrack.click();

  // Character select screen -- wait for a recognizable element
  // The stat labels "Rychlost" or "Speed" appear only on character select
  const charMarker = page.locator('text=/Formule|Formula/').first();
  await expect(charMarker).toBeVisible({ timeout: 5000 });

  // Confirm character (Space confirms P1 in both 1P and 2P modes)
  await page.keyboard.press('Space');

  // Wait for the game screen (canvas) to appear.
  // 400ms confirmation delay + 300ms transition animation.
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// 1. Title screen loads
// ---------------------------------------------------------------------------
test.describe('Title screen', () => {
  test('displays the title text', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('text=Ol');
    await expect(title.first()).toBeVisible({ timeout: 10000 });
  });

  test('displays "press any key" prompt', async ({ page }) => {
    await page.goto('/');
    const prompt = page.locator('text=/[Ss]tiskni|[Pp]ress/');
    await expect(prompt.first()).toBeVisible({ timeout: 10000 });
  });

  test('displays the language toggle button', async ({ page }) => {
    await page.goto('/');
    const langButton = page.locator('button', { hasText: /^EN$|^CZ$/ });
    await expect(langButton).toBeVisible({ timeout: 10000 });
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
    expect(width).toBe('480');
    expect(height).toBe('854');
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

    await page.locator('text=/[Ss]tiskni|[Pp]ress/').first().waitFor({ timeout: 10000 });

    const langButton = page.locator('button', { hasText: /^EN$|^CZ$/ });
    await expect(langButton).toBeVisible({ timeout: 5000 });

    // Get the current "press any key" text before toggle
    const promptBefore = await page
      .locator('text=/[Ss]tiskni|[Pp]ress/')
      .first()
      .textContent();

    // Click language button to switch to English
    await langButton.click({ force: true });

    // Wait for the language button text to change (from "EN" to "CZ")
    await expect(langButton).toHaveText(/CZ/, { timeout: 3000 });

    // "Press any key" text should now be in English
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

    // Verify pause overlay appears
    const pausedText = page.locator('text=/[Pp]auz|[Pp]ause/');
    await expect(pausedText.first()).toBeVisible({ timeout: 3000 });

    // Verify Resume button
    const resumeBtn = page.locator(
      'button:has-text("Pokra"), button:has-text("Resume")',
    ).first();
    await expect(resumeBtn).toBeVisible({ timeout: 3000 });

    // Verify Restart button
    const restartBtn = page.locator(
      'button:has-text("Restart")',
    ).first();
    await expect(restartBtn).toBeVisible({ timeout: 3000 });

    // Verify Quit button
    const quitBtn = page.locator(
      'button:has-text("Hlavn"), button:has-text("Quit")',
    ).first();
    await expect(quitBtn).toBeVisible({ timeout: 3000 });
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
    await page.goto('/');
    await page.locator('text=/[Ss]tiskni|[Pp]ress/').first().waitFor({ timeout: 10000 });

    await page.keyboard.press('Enter');

    const option1 = page.locator('button', { hasText: '1' }).first();
    await expect(option1).toBeVisible({ timeout: 5000 });

    const option2 = page.locator('button', { hasText: '2' }).first();
    await expect(option2).toBeVisible({ timeout: 5000 });
  });

  test('track select screen shows all 3 tracks', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=/[Ss]tiskni|[Pp]ress/').first().waitFor({ timeout: 10000 });
    await page.keyboard.press('Enter');

    const onePlayerBtn = page.locator('button', { hasText: '1' }).first();
    await expect(onePlayerBtn).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('1');

    // Wait for track select header
    const trackHeader = page.locator('text=/[Vv]yber tra|[Ss]elect [Tt]rack/');
    await expect(trackHeader.first()).toBeVisible({ timeout: 5000 });

    // Count track buttons by looking for difficulty badges
    const trackButtons = page.locator('button').filter({
      hasText: /[Ll]ehk|[Ss]třed|[Tt]ěžk|[Ee]asy|[Mm]edium|[Hh]ard/,
    });
    const count = await trackButtons.count();
    expect(count).toBe(3);
  });

  test('character select screen shows characters', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=/[Ss]tiskni|[Pp]ress/').first().waitFor({ timeout: 10000 });
    await page.keyboard.press('Enter');

    const onePlayerBtn = page.locator('button', { hasText: '1' }).first();
    await expect(onePlayerBtn).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('1');

    // Track select -- click first track by name
    const firstTrack = page.locator('button').filter({ hasText: /[Nn]ed|[Ss]unday/ }).first();
    await expect(firstTrack).toBeVisible({ timeout: 5000 });
    await firstTrack.click();

    // Character select -- wait for character name to appear
    const charMarker = page.locator('text=/Formule|Formula/').first();
    await expect(charMarker).toBeVisible({ timeout: 5000 });

    // Count character buttons by names
    const charNames = page.locator(
      'button:has-text("Formule"), button:has-text("Formula"), button:has-text("Yeti"), button:has-text("Ko"), button:has-text("Cat"), button:has-text("Pras"), button:has-text("Pig"), button:has-text("Žab"), button:has-text("Frog")',
    );
    const count = await charNames.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('quit from pause returns to title screen', async ({ page }) => {
    await navigateToGame(page);

    // Pause
    await page.keyboard.press('Escape');

    // Verify pause is visible
    const pausedText = page.locator('text=/[Pp]auz|[Pp]ause/');
    await expect(pausedText.first()).toBeVisible({ timeout: 3000 });

    // Navigate to the Quit option using arrow keys and select it
    await page.keyboard.press('ArrowDown'); // -> Restart
    await page.keyboard.press('ArrowDown'); // -> Quit
    await page.keyboard.press('Enter');

    // Should be back at title screen (after transition)
    const titlePrompt = page.locator('text=/[Ss]tiskni|[Pp]ress/');
    await expect(titlePrompt.first()).toBeVisible({ timeout: 8000 });
  });
});
