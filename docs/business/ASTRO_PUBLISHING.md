# Asteria Astro Publishing

## Status

**Active v1 public publishing path:** Astro static site hosted on Cloudflare Pages.

Cloudflare Pages is not configured in this mission and no site is deployed. The repository produces a local static build only. Automatic public publishing is prohibited.

The WordPress adapter remains in the repository for compatibility and historical reference, but it is **deprecated and inactive** for Asteria v1. Do not configure WordPress credentials or use the WordPress draft endpoint for v1 publishing.

## Responsibilities

- Asteria generates and stores reviewed Markdown under `generated/pets/`.
- A named human editor selects an exact source revision for public use.
- The approval manifest at `sites/pets/content/approvals.json` records that decision.
- The public-content preparation step copies only allowlisted public sections into an isolated generated collection.
- Astro renders only that isolated collection into static HTML, sitemap, robots, and RSS output.
- Cloudflare Pages may host the static output only after a separately approved deployment mission.

## Human Approval Gate

An article enters the public build only when its manifest entry contains all of the following:

- `approved: true`
- A named human `approvedBy` value
- A valid `approvedAt` timestamp
- A public slug and category
- `approvedRevision` equal to the SHA-256 of the exact source Markdown

The preparation script rejects automation, bot, system, pipeline, or Codex labels as approvers. If an approved source changes, its checksum no longer matches and the build fails until a human reviews the new revision and updates the manifest. An editorial diagnostic such as `PASS` is not, by itself, public approval.

### Approval Procedure

1. Complete the existing human editorial checklist for the exact Markdown revision.
2. Confirm the article, summary, SEO fields, FAQ, factual safety, rights, and publishing decision.
3. Calculate the source SHA-256 with `shasum -a 256 generated/pets/<file>.md`.
4. Add or update the manifest entry with the human editor's name, approval time, and exact checksum.
5. Run `npm run site:build`.
6. Review the generated site locally before any separately approved deployment.

Removing an entry or setting `approved` to `false` excludes the article from article pages, lists, categories, RSS, and sitemap on the next build.

## Public Boundary

The Astro content collection never reads `generated/pets/` directly. `scripts/prepare-public-content.ts` extracts only:

- Article title and body
- Summary
- SEO title and description
- FAQ
- Public category and publication date from the approval manifest

The following source sections and values are never copied into the public collection:

- Run metadata
- Provider or model information
- Workflow status and timing
- Editorial Review diagnostics
- Scores, issues, and review internals
- Approver identity and approved revision checksum

The preparation step fails when forbidden internal markers cross the boundary. Automated tests also scan generated pages, lists, RSS, robots, sitemap, and 404 output.

## Local Commands

```bash
npm run site:dev
npm run site:build
```

The static output is written to `sites/pets/dist/` and is intentionally ignored by Git.

Set `ASTERIA_PUBLIC_SITE_URL` to the final canonical HTTPS origin during a future Cloudflare configuration mission. Until then, builds use the reserved non-public placeholder `https://pets.asteria.example`.

## Cloudflare Pages Handoff

When deployment is separately approved, use the repository root as the build root with:

- Build command: `npm run site:build`
- Output directory: `sites/pets/dist`
- Canonical environment variable: `ASTERIA_PUBLIC_SITE_URL`

Do not enable deployment hooks, automatic production builds, custom domains, Pages configuration, or credentials in this mission. The future deployment workflow must preserve the checksum-based human approval gate before every public build.
