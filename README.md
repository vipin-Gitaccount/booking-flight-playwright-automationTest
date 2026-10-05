# AKQA SQA Takeaway — Playwright (Case 1)

Automates **Booking.com Flights** search: **DEL → BOM** for **today / tomorrow** (+ extras).

Target: https://www.booking.com/flights/index.en-gb.html

---

## Run in VS Code (easy)

### 1. Open the folder
Open only this folder in VS Code:

`playwright-flights`

(File → Open Folder…)

### 2. Install (Terminal in VS Code)

```bash
npm install
npx playwright install chromium
```

### 3. Run tests

```bash
# headless
npm test

# see the browser
npm run test:headed

# Playwright UI mode (best for demos)
npm run test:ui
```

### 4. Report

```bash
npm run test:report
```

---

## VS Code tips

- Install extension: **Playwright Test for VS Code** (`ms-playwright.playwright`)
- Use Testing sidebar → run individual tests with one click
- Launch configs are in `.vscode/launch.json`
- If VS Code freezes on open: it was indexing `test-results` / `playwright-report`. Those are excluded in `.vscode/settings.json`. Delete those folders and reopen, or run:
  `code --disable-workspace-trust .` from this directory.

---

## What’s covered

| Test | Maps to challenge |
|------|-------------------|
| Tomorrow DEL→BOM | Case 1a |
| Today DEL→BOM | Case 1a |
| Search controls smoke | Case 1b |
| Day+2 route context | Case 1b |

Part 1 answers (requirement evaluation): see `../01_Requirement_Evaluation_Answers.md`

---

## Notes / risks

- Booking.com uses cookie banners, geo redirects, and frequent UI A/B tests.
- Helpers try multiple selectors; if a run flakes, re-run headed and adjust `tests/helpers.js`.
- Captcha / bot walls may block CI IPs — local headed runs are recommended for demos.

---

## Project layout

```
playwright-flights/
  package.json
  playwright.config.js
  tests/
    booking-flights.spec.js
    helpers.js
  .vscode/
    launch.json
    extensions.json
```
