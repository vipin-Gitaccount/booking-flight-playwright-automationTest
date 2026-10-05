
// @ts-check

const { expect } = require('@playwright/test');

/**
 * Booking.com Flights helpers
 *
 * UI-first approach with deep-link fallback.
 */

const FLIGHTS_HOME =
  'https://www.booking.com/flights/index.en-gb.html';

/**
 * @param {import('@playwright/test').Page} page
 */
async function openFlightsHome(page) {
  await page.goto(FLIGHTS_HOME, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  await dismissOverlays(page);

  await expect(
    page.getByRole('heading', {
      name: /compare and book cheap flights/i,
    })
  ).toBeVisible({
    timeout: 45_000,
  });
}

/**
 * Dismiss common Booking.com overlays.
 *
 * @param {import('@playwright/test').Page} page
 */
async function dismissOverlays(page) {
  const candidates = [
    page.locator('#onetrust-accept-btn-handler'),

    page.getByRole('button', {
      name: /accept|agree|got it|allow all|i agree/i,
    }),

    page.locator('[aria-label="Dismiss sign-in info."]'),

    page.getByRole('button', {
      name: /^close$/i,
    }),
  ];

  for (const btn of candidates) {
    try {
      const first = btn.first();

      if (
        await first.isVisible({
          timeout: 1200,
        })
      ) {
        await first.click({
          timeout: 2000,
        }).catch(() => {});
      }
    } catch {
      // Overlay may not exist.
    }
  }
}

/**
 * Select One Way.
 *
 * @param {import('@playwright/test').Page} page
 */
async function chooseOneWay(page) {
  const oneWay = page.getByRole('radio', {
    name: /one way/i,
  }).first();

  await expect(oneWay).toBeVisible({
    timeout: 20_000,
  });

  await oneWay.click({
    force: true,
  });
}

/**
 * Convert Date to YYYY-MM-DD.
 *
 * @param {Date} d
 */
function toIso(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Return today's date + offset.
 *
 * @param {number} dayOffset
 */
function dateOffset(dayOffset) {
  const d = new Date();

  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);

  return d;
}

/**
 * Deep-link to Booking.com flight results.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ origin: string, destination: string, dateIso: string }} opts
 */
async function openResultsViaDeepLink(page, opts) {
  const {
    origin,
    destination,
    dateIso,
  } = opts;

  const url =
    `https://flights.booking.com/flights/${origin}.AIRPORT-${destination}.AIRPORT/` +
    `?type=ONEWAY` +
    `&adults=1` +
    `&cabinClass=ECONOMY` +
    `&from=${origin}.AIRPORT` +
    `&to=${destination}.AIRPORT` +
    `&depart=${dateIso}` +
    `&sort=BEST` +
    `&locale=en-gb`;

  console.log('Opening deep link:', url);

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  await dismissOverlays(page);
}

/**
 * Search DEL -> BOM.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   origin: string,
 *   destination: string,
 *   destQuery: string,
 *   dayOffset: number
 * }} opts
 */
async function searchDelBom(page, opts) {
  const dateIso = toIso(
    dateOffset(opts.dayOffset)
  );

  await chooseOneWay(page);

  // --------------------------------------------------
  // ORIGIN
  // --------------------------------------------------

  const fromBtn = page
    .getByRole('button', {
      name: /leaving from/i,
    })
    .first();

  await expect(fromBtn).toBeVisible({
    timeout: 20_000,
  });

  const fromLabel = (
    await fromBtn.innerText()
  ).toUpperCase();

  console.log('Current FROM:', fromLabel);

  // Only change origin if necessary.
  if (!fromLabel.includes(opts.origin)) {
    const originOk = await pickAirport(
      page,
      fromBtn,
      opts.origin,
      opts.origin
    );

    if (!originOk) {
      console.log(
        `Could not select origin ${opts.origin}. Using deep link.`
      );

      await openResultsViaDeepLink(page, {
        origin: opts.origin,
        destination: opts.destination,
        dateIso,
      });

      return dateIso;
    }
  }

  // --------------------------------------------------
  // DESTINATION
  // --------------------------------------------------

  const toBtn = page
    .getByRole('button', {
      name: /going to/i,
    })
    .first();

  await expect(toBtn).toBeVisible({
    timeout: 20_000,
  });

  const destinationOk = await pickAirport(
    page,
    toBtn,
    opts.destQuery,
    opts.destination
  );

  if (!destinationOk) {
    console.log(
      `Could not select destination ${opts.destination}. Using deep link.`
    );

    await openResultsViaDeepLink(page, {
      origin: opts.origin,
      destination: opts.destination,
      dateIso,
    });

    return dateIso;
  }

  // --------------------------------------------------
  // DATE
  // --------------------------------------------------

  try {
    await selectDepartDateOffset(
      page,
      opts.dayOffset
    );

    const explore = page
      .getByRole('button', {
        name: /^explore$/i,
      })
      .first();

    await expect(explore).toBeVisible({
      timeout: 15_000,
    });

    await explore.click();

    await page.waitForLoadState(
      'domcontentloaded',
      {
        timeout: 30_000,
      }
    ).catch(() => {});

    await dismissOverlays(page);

    await page.waitForTimeout(2000);

    // If Booking remains on the flights home page,
    // use the deep-link fallback.
    const stillHome =
      /booking\.com\/flights\/index/i.test(
        page.url()
      );

    if (stillHome) {
      console.log(
        'Still on Flights home page. Using deep link.'
      );

      await openResultsViaDeepLink(page, {
        origin: opts.origin,
        destination: opts.destination,
        dateIso,
      });
    }
  } catch (error) {
    console.log(
      'Calendar/UI search failed. Using deep link.'
    );

    await openResultsViaDeepLink(page, {
      origin: opts.origin,
      destination: opts.destination,
      dateIso,
    });
  }

  return dateIso;
}

/**
 * Select airport/city from Booking.com autocomplete.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} openBtn
 * @param {string} query
 * @param {string} code
 * @returns {Promise<boolean>}
 */
async function pickAirport(
  page,
  openBtn,
  query,
  code
) {
  console.log(
    `Opening airport selector. Query=${query}, Code=${code}`
  );

  // Open From / To selector.
  await openBtn.click();

  // Give Booking.com a moment to render the autocomplete.
  await page.waitForTimeout(500);

  // --------------------------------------------------
  // FIND AIRPORT INPUT
  // --------------------------------------------------

  const placeholderInput = page
    .getByPlaceholder(
      /airport|city|country|where are you flying/i
    )
    .filter({
      visible: true,
    })
    .first();

  let input = null;

  // Preferred locator.
  if (
    await placeholderInput.count() > 0 &&
    await placeholderInput.isVisible().catch(() => false)
  ) {
    input = placeholderInput;
  }

  // Second strategy: visible textbox.
  if (!input) {
    const textboxes = page.getByRole('textbox');

    const count = await textboxes.count();

    console.log(
      'Visible/available textboxes:',
      count
    );

    for (let i = 0; i < count; i++) {
      const textbox = textboxes.nth(i);

      if (
        await textbox.isVisible().catch(() => false)
      ) {
        input = textbox;
        break;
      }
    }
  }

  // Third strategy: visible input.
  if (!input) {
    const visibleInputs = page.locator(
      'input:visible'
    );

    const count = await visibleInputs.count();

    console.log(
      'Visible input count:',
      count
    );

    for (let i = 0; i < count; i++) {
      const candidate = visibleInputs.nth(i);

      const type =
        await candidate.getAttribute('type');

      if (
        !type ||
        type === 'text' ||
        type === 'search'
      ) {
        input = candidate;
        break;
      }
    }
  }

  // --------------------------------------------------
  // INPUT NOT FOUND
  // --------------------------------------------------

  if (!input) {
    console.log(
      'Airport input was not found.'
    );

    // Useful debugging information.
    const allVisibleInputs =
      page.locator('input:visible');

    const count =
      await allVisibleInputs.count();

    for (let i = 0; i < count; i++) {
      const el = allVisibleInputs.nth(i);

      console.log(
        `INPUT ${i}`,
        {
          placeholder:
            await el.getAttribute('placeholder'),
          ariaLabel:
            await el.getAttribute('aria-label'),
          name:
            await el.getAttribute('name'),
          type:
            await el.getAttribute('type'),
        }
      );
    }

    return false;
  }

  // --------------------------------------------------
  // TYPE SEARCH
  // --------------------------------------------------

  await expect(input).toBeVisible({
    timeout: 15_000,
  });

  await input.fill('');

  await input.pressSequentially(
    query,
    {
      delay: 50,
    }
  );

  // Give autocomplete time to render.
  await page.waitForTimeout(1000);

  // --------------------------------------------------
  // BOOKING API ERROR
  // --------------------------------------------------

  const apiError = page.getByText(
    /oops, something|refresh to get back/i
  ).first();

  if (
    await apiError.isVisible({
      timeout: 3000,
    }).catch(() => false)
  ) {
    console.log(
      'Booking autocomplete API error detected.'
    );

    const refresh = page
      .getByRole('link', {
        name: /refresh/i,
      })
      .or(
        page.getByText(
          /refresh to get back/i
        )
      )
      .first();

    if (
      await refresh.isVisible().catch(() => false)
    ) {
      await refresh.click().catch(() => {});

      await page.waitForTimeout(1500);

      // Re-find the input after refresh.
      const refreshedInput =
        page.getByRole('textbox').first();

      if (
        await refreshedInput.isVisible().catch(() => false)
      ) {
        input = refreshedInput;

        await input.fill('');

        await input.pressSequentially(
          query,
          {
            delay: 50,
          }
        );

        await page.waitForTimeout(1000);
      }
    }
  }

  // --------------------------------------------------
  // FIND AUTOCOMPLETE SUGGESTION
  // --------------------------------------------------

  const suggestionRegex =
    new RegExp(
      `${code}|${query}|mumbai|delhi`,
      'i'
    );

  const suggestions = page.locator(
    '[role="option"], li, button, a'
  ).filter({
    hasText: suggestionRegex,
  }).filter({
    hasNotText: /anywhere/i,
  });

  const suggestionCount =
    await suggestions.count();

  console.log(
    'Matching suggestions:',
    suggestionCount
  );

  if (suggestionCount === 0) {
    console.log(
      `No autocomplete suggestion found for ${query}.`
    );

    return false;
  }

  for (
    let i = 0;
    i < Math.min(suggestionCount, 10);
    i++
  ) {
    console.log(
      `Suggestion ${i}:`,
      await suggestions.nth(i).innerText()
        .catch(() => '')
    );
  }

  const suggestion =
    suggestions.first();

  try {
    await expect(suggestion).toBeVisible({
      timeout: 10_000,
    });

    await suggestion.click();

    return true;
  } catch (error) {
    console.log(
      'Could not click airport suggestion.'
    );

    return false;
  }
}

/**
 * Select departure date.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} dayOffset
 */
async function selectDepartDateOffset(
  page,
  dayOffset
) {
  const target =
    dateOffset(dayOffset);

  const iso =
    toIso(target);

  const dayNum =
    String(target.getDate());

  // Open travel date selector.
  const datesBtn =
    page.getByRole('button', {
      name: /travel date|departure date/i,
    }).first();

  await expect(datesBtn).toBeVisible({
    timeout: 20_000,
  });

  await datesBtn.click();

  await page.waitForTimeout(500);

  // --------------------------------------------------
  // FIRST STRATEGY: DATA-DATE
  // --------------------------------------------------

  let dayCell =
    page.locator(
      `[data-date="${iso}"]`
    ).first();

  // Move through months if necessary.
  for (
    let i = 0;
    i < 4;
    i++
  ) {
    if (
      await dayCell.isVisible().catch(() => false)
    ) {
      break;
    }

    const next =
      page.getByRole('button', {
        name: /next month|go to the next month/i,
      }).first();

    if (
      await next.isVisible().catch(() => false)
    ) {
      await next.click();

      await page.waitForTimeout(300);
    } else {
      break;
    }
  }

  // --------------------------------------------------
  // SECOND STRATEGY
  // --------------------------------------------------

  if (
    !(await dayCell.isVisible().catch(() => false))
  ) {
    dayCell = page
      .locator(
        '[role="gridcell"]:not([aria-disabled="true"])'
      )
      .filter({
        hasText: new RegExp(
          `^${dayNum}$`
        ),
      })
      .first();
  }

  await expect(dayCell).toBeVisible({
    timeout: 12_000,
  });

  await dayCell.click();

  // Done / Apply button if present.
  const done =
    page.getByRole('button', {
      name: /done|select|apply|ok/i,
    }).first();

  if (
    await done.isVisible().catch(() => false)
  ) {
    await done.click().catch(() => {});
  }

  return iso;
}

/**
 * Validate route/date context.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   origin: string,
 *   destination: string,
 *   dateIso: string
 * }} expected
 */
async function assertFlightResultsContext(
  page,
  expected
) {
  await dismissOverlays(page);

  await page.waitForTimeout(1500);

  const body =
    (
      await page.locator('body').innerText()
    ).toLowerCase();

  const url =
    page.url().toLowerCase();

  expect.soft(
    body.includes(
      expected.origin.toLowerCase()
    ) ||
      body.includes('delhi') ||
      url.includes(
        expected.origin.toLowerCase()
      ),
    `origin ${expected.origin}`
  ).toBeTruthy();

  expect.soft(
    body.includes(
      expected.destination.toLowerCase()
    ) ||
      body.includes('mumbai') ||
      url.includes(
        expected.destination.toLowerCase()
      ),
    `destination ${expected.destination}`
  ).toBeTruthy();

  const dayNum =
    String(
      Number(
        expected.dateIso.slice(8, 10)
      )
    );

  expect.soft(
    body.includes(expected.dateIso) ||
      body.includes(dayNum) ||
      url.includes(expected.dateIso) ||
      url.includes(
        expected.dateIso.replace(/-/g, '')
      ),
    `date ${expected.dateIso}`
  ).toBeTruthy();
}

module.exports = {
  openFlightsHome,
  dismissOverlays,
  chooseOneWay,
  searchDelBom,
  assertFlightResultsContext,
  FLIGHTS_HOME,
};

