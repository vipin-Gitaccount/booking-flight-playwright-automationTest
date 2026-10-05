// @ts-check
const { test, expect } = require('@playwright/test');
const {
  openFlightsHome,
  searchDelBom,
  assertFlightResultsContext,
  dismissOverlays,
} = require('./helpers');

test.describe('Booking.com — Search flights DEL → BOM', () => {
  test.beforeEach(async ({ page }) => {
    await openFlightsHome(page);
  });

  test('a1) Tomorrow — DEL to BOM shows results for selected date', async ({ page }) => {
    const dateIso = await searchDelBom(page, {
      origin: 'DEL',
      destination: 'BOM',
      destQuery: 'Mumbai',
      dayOffset: 1,
    });
    await dismissOverlays(page);
    await assertFlightResultsContext(page, { origin: 'DEL', destination: 'BOM', dateIso });
  });

  test('a2) Today — DEL to BOM shows results for selected date', async ({ page }) => {
    const dateIso = await searchDelBom(page, {
      origin: 'DEL',
      destination: 'BOM',
      destQuery: 'Mumbai',
      dayOffset: 0,
    });
    await dismissOverlays(page);
    await assertFlightResultsContext(page, { origin: 'DEL', destination: 'BOM', dateIso });
  });

  test('b1) Extra — Flights home exposes search controls', async ({ page }) => {
    await expect(page).toHaveURL(/flights/i);
    await expect(page.getByRole('button', { name: /leaving from/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /going to/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^explore$/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /one way/i })).toBeVisible();
  });

  test('b2) Extra — Day+2 search still returns route context', async ({ page }) => {
    const dateIso = await searchDelBom(page, {
      origin: 'DEL',
      destination: 'BOM',
      destQuery: 'Mumbai',
      dayOffset: 2,
    });
    await dismissOverlays(page);
    await assertFlightResultsContext(page, { origin: 'DEL', destination: 'BOM', dateIso });
  });
});
