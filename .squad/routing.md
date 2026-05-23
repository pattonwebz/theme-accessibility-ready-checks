# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|---------|
| Docker, CI, toolchain, test runner setup | Keaton | docker-compose config, Playwright config, npm scripts, tsconfig, GitHub Actions |
| Playwright test authoring, TypeScript | McManus | Writing test files, page objects, locator strategy, assertions, test utilities |
| Accessibility requirements, test accuracy review | Fenster | WCAG mapping, validating assertions are correct, identifying untestable requirements |
| WordPress theme structure, content fixtures | Kobayashi | Template hierarchy, HTML output, block vs classic themes, fixture page setup |
| Code review | Fenster + McManus | Fenster reviews accessibility accuracy; McManus reviews test code quality |
| Scope & priorities | Keaton (Lead) | What to build next, trade-offs, architecture decisions |
| Session logging | Scribe | Automatic — never needs routing |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Keaton |
| `squad:keaton` | Docker/CI/toolchain work | Keaton |
| `squad:mcmanus` | Playwright test authoring | McManus |
| `squad:fenster` | Accessibility requirement review | Fenster |
| `squad:kobayashi` | WordPress theme concerns | Kobayashi |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, **Keaton** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Keaton review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for simple questions.
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If McManus is writing a test, spawn Fenster to review the requirement simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. Keaton handles all `squad` (base label) triage.
