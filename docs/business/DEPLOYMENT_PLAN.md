# Asteria Public Deployment Plan

## Purpose

Select the public publishing destination for Asteria v1 without changing the internal generation workflow or redesigning the architecture. The decision should minimize time to the first human-approved public article while satisfying the launch checklist for SEO, ownership, disclosure, backup, monitoring, and editorial control.

## Current Constraints

- Asteria is an internal content engine and browser editor, not a public content website.
- The repository contains generated editorial drafts but no public site, domain configuration, policy pages, sitemap, robots file, RSS feed, analytics, backup, or production monitoring.
- Asteria already has a draft-only WordPress integration and exposes no public-publish action.
- The Operation Log currently records HOLD for the first editorial run.
- Human review and an explicit publishing decision must remain between generation and public release.
- There is no documented existing blog available for integration.

## Option Comparison

Ratings are relative to Asteria's present state. Costs are qualitative because hosting, traffic, support, and operator choices are not yet fixed.

### Summary

| Option | Setup complexity | SEO | Cost | Performance | Maintenance | Recommended use case |
| --- | --- | --- | --- | --- | --- | --- |
| Static Site (Astro) | Medium | Strong when metadata and integrations are configured | Low | Excellent for pre-rendered editorial pages | Low infrastructure; medium content/build operations | A content-first site with Git-based publishing, few editors, and no immediate CMS requirement |
| Next.js | High | Strong and flexible | Medium | Strong, but depends on rendering, caching, and hosting choices | Medium to high | A public product that soon needs accounts, personalization, dynamic tools, or application workflows |
| WordPress | Low to medium | Strong baseline with editorial configuration and optional plugins | Low to medium | Good with a restrained theme, caching, and managed hosting | Medium; lowest with managed hosting | A publication that needs the fastest human editorial launch and familiar draft/review operations |
| Existing Blog Integration | Low only when a suitable blog already exists | Inherits the host site's authority and limitations | Lowest incremental cost | Inherits the existing platform | Shared with the existing owner | A validated, controlled blog already aligned with the Pets Magazine brand and measurement needs |

### Static Site (Astro)

**Setup complexity:** Medium. Astro defaults to static output and can deploy to many static hosts, but Asteria would still need a new public-site project, content ingestion rules, templates, policy pages, images, deployment automation, preview, and an editorial handoff. Astro's deployment documentation confirms static builds produce a `dist` output and can be connected to Git-based continuous deployment. [Astro deployment documentation](https://docs.astro.build/en/guides/deploy/)

**SEO:** Strong. Pre-rendered article pages provide crawlable HTML, and Astro offers official paths for sitemap and RSS generation. These capabilities still require configuration, canonical policy, metadata templates, and production validation. [Astro sitemap integration](https://v4.docs.astro.build/en/guides/integrations-guide/sitemap/), [Astro RSS recipe](https://docs.astro.build/de/recipes/rss/)

**Cost:** Low for a static host at early traffic levels. Domain, analytics, image storage, and any editorial CMS or preview service remain separate costs.

**Performance:** Excellent by default for a mostly static magazine. Astro's default output mode pre-renders pages unless a route opts into on-demand rendering. [Astro configuration reference](https://docs.astro.build/en/reference/configuration-reference/)

**Maintenance:** Low server maintenance, but content updates require a build-and-deploy process. Non-technical editors may need a CMS or a carefully documented Git workflow.

**Recommended use case:** Choose Astro when Asteria has validated editorial demand, a small technical publishing team, and a deliberate preference for a Git-managed static publication over a visual CMS.

### Next.js

**Setup complexity:** High relative to the current need. Next.js can produce a static export or run a Node server, but choosing rendering, cache, image, hosting, preview, and content-management behavior adds decisions that are unnecessary for one public article. Official documentation confirms static exports can be served by any static web server, while the complete feature set requires a Node.js-capable platform. [Next.js static export guide](https://nextjs.org/docs/pages/guides/static-exports), [Next.js deployment guide](https://nextjs.org/docs/app/guides/deploying-to-platforms)

**SEO:** Strong. Next.js provides metadata APIs and file conventions for titles, descriptions, Open Graph assets, sitemap, and robots files. The team would still own correct implementation and ongoing validation. [Next.js metadata documentation](https://nextjs.org/docs/app/getting-started/metadata-and-og-images), [Next.js metadata file conventions](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)

**Cost:** Medium. A static export may be inexpensive, but server rendering, preview environments, image handling, and dynamic features can increase platform and operational cost.

**Performance:** Strong when rendering and caching are designed well. It has more runtime and bundle choices than Asteria v1 needs, which creates more opportunities for configuration-dependent performance.

**Maintenance:** Medium to high. Framework upgrades, application dependencies, hosting behavior, caching, security headers, and production builds require active engineering ownership. The official production checklist also expects deliberate review of metadata, robots, sitemap, bundles, caching, and Core Web Vitals. [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)

**Recommended use case:** Choose Next.js when the public destination is becoming a product application with authentication, personalization, interactive tools, or shared server-side functionality. Those requirements are outside Asteria v1.

### WordPress

**Setup complexity:** Low to medium. A managed WordPress host can provide installation, updates, backup tooling, and operational support, while Asteria already creates WordPress drafts through an authenticated draft-only path. WordPress documents both general and WordPress-specific hosting, noting that managed offerings may include backups, updates, and developer tools. [WordPress hosting documentation](https://wordpress.org/documentation/article/hosting-wordpress/)

**SEO:** Strong baseline for a publication. WordPress supports indexable posts, pages, categories, permalinks, and feeds; metadata, sitemap, canonical, and robots behavior must still be verified against the launch checklist. [WordPress SEO documentation](https://wordpress.org/documentation/article/search-engine-optimization/)

**Cost:** Low to medium. Managed hosting, domain, a well-supported theme, backup retention, and any paid plugins create recurring cost, but avoid building and operating a separate public frontend for the first validation cycle.

**Performance:** Good when using a lightweight theme, limited plugins, image optimization, caching, and a capable managed host. Performance is more variable than a purely static Astro site and must be measured before launch.

**Maintenance:** Medium. Core, theme, and plugin updates require ownership and staging verification. Managed hosting reduces server operations but does not remove editorial QA, security, backup restore tests, or monitoring.

**Recommended use case:** Choose WordPress for Asteria v1 when the priority is a fast, human-controlled publication workflow using the integration already validated locally. Application Passwords provide a dedicated REST authentication mechanism, but credentials must remain server-side and least-privileged. [WordPress Application Passwords documentation](https://developer.wordpress.org/rest-api/reference/application-passwords/)

### Existing Blog Integration

**Setup complexity:** Potentially low, but currently unknown. It is low only if an existing site is controlled by the Founder, supports the required article format and disclosures, and permits safe draft ingestion or manual transfer.

**SEO:** Can be immediately strong if the existing domain has relevant authority, healthy indexing, clean information architecture, and no conflicting topic focus. It can also be weak if the domain, canonical policy, or audience is mismatched.

**Cost:** Lowest incremental cost when hosting, analytics, backup, and monitoring already exist. Migration, redesign, ownership conflicts, or editorial constraints can erase that advantage.

**Performance:** Inherits the current site's platform, theme, plugins, hosting, and technical debt.

**Maintenance:** Shared with the existing site owner. Release scheduling, permissions, analytics separation, disclosures, and rollback must be agreed before use.

**Recommended use case:** Choose this only when a specific existing blog passes the full launch checklist and has documented ownership, editorial control, audience fit, analytics access, and a reversible integration plan. No such site is currently documented, so this is not a selectable Asteria v1 destination.

## Asteria v1 Decision

### Recommended Option: Managed WordPress

Use a dedicated managed WordPress site as the Asteria v1 public destination.

This is the shortest responsible path because:

1. Asteria already produces WordPress drafts and preserves a human approval boundary.
2. WordPress supplies the editorial post and page model needed for articles, Privacy, About, Contact, categories, feeds, and revisions without building a new public application.
3. Managed hosting can reduce the operational burden for updates, backups, TLS, and support while the business is still validating readership.
4. The launch does not require accounts, personalization, or interactive application features that would justify Next.js.
5. Astro offers the best static performance profile, but it requires a new public-site build and a new content deployment handoff before Asteria has validated its first public article.
6. No suitable existing blog has been identified and verified.

### Decision Boundaries

- Keep Asteria and WordPress operationally separate: Asteria generates and edits; WordPress hosts the public publication.
- Keep the current draft-only safeguard. Do not add automatic public publishing for v1.
- Require a human to review the WordPress draft, verify the public-safe content and image, and press Publish in WordPress.
- Use a dedicated least-privilege WordPress account and Application Password for Asteria.
- Start with a restrained theme and the minimum necessary plugins.
- Do not introduce headless WordPress, Next.js, or Astro during v1 launch validation.
- Reconsider the public frontend only after 90-day evidence shows a concrete limitation that WordPress cannot meet economically or operationally.

## Migration Roadmap

### Phase 1: Public Foundation

**Objective:** Establish a private staging site and close the non-content launch blockers.

- Select the managed WordPress host, production domain, site owner, billing owner, and recovery contacts.
- Create staging and production environments with HTTPS and separate access.
- Configure a lightweight theme, permalink structure, categories, article template, and footer.
- Prepare Privacy, About, Contact, correction/reporting, affiliate, and AI/editorial disclosure content.
- Establish sitemap, robots, RSS, canonical, metadata, image, backup, restore, and monitoring requirements.
- Configure a dedicated least-privilege Asteria integration account and rotate the local test credential.
- Transfer article 001 as a draft only; do not publish.

**Exit gate:** B01-B10 in the Launch Checklist have assigned owners and evidence, the staging draft contains no internal run metadata, and backup restore plus alert delivery have been tested.

### Phase 2: Controlled First Launch

**Objective:** Publish one article through the complete human-reviewed operating cycle.

- Complete factual, safety, copyright, accessibility, SEO, mobile, desktop, and disclosure review for article 001.
- Confirm analytics, Google Search Console, Naver Search Advisor, sitemap, robots, RSS, and canonical behavior on production.
- Compare the WordPress draft against the approved Asteria working copy.
- Record measured editing time, review result, publishing decision, and improvement notes in the Operation Log.
- Obtain a named human PUBLISH decision and publish manually in WordPress.
- Verify the public URL, feed entry, indexability, sharing metadata, monitoring, and rollback path.
- Observe the first article for errors and reader feedback before scheduling the next batch.

**Exit gate:** All applicable Launch Checklist items are READY, article 001 is public and monitored, no private metadata is exposed, and the Operation Log contains the named approval and post-launch verification result.

### Phase 3: Repeatable Editorial Operations

**Objective:** Prove that the public workflow can support the business plan without weakening quality.

- Publish the next approved P1 articles at the planned cadence, retaining manual WordPress approval.
- Review the Operation Log after each batch for editing time, rewrite causes, source gaps, image friction, and publishing errors.
- Maintain internal links, categories, sitemap, RSS, disclosures, backups, updates, and monitoring.
- Measure 30- and 90-day acquisition, editorial, trust, and operational metrics from the Business Plan.
- Introduce affiliate links only after the disclosure and product-review process is approved; keep advertising disabled during the initial quality baseline.
- Document any repeated WordPress limitation with frequency, cost, reader impact, and a minimum required capability before considering another frontend.

**Exit gate:** The 90-day review demonstrates a repeatable editorial cycle and produces an evidence-based decision to continue WordPress, optimize it, or open a separately scoped platform evaluation.

## Decision Review Triggers

Reopen the platform decision only when one or more of these conditions is measured repeatedly:

- WordPress performance remains below the agreed threshold after theme, image, caching, and hosting remediation.
- Editorial operations require structured content or preview behavior that cannot be maintained safely in WordPress.
- Asteria introduces an approved public interactive product that materially requires application runtime behavior.
- WordPress maintenance cost exceeds a documented Astro or Next.js migration and ownership estimate.
- A verified existing blog becomes available and passes the complete launch checklist.

Until a trigger is supported by operating evidence, managed WordPress remains the Asteria v1 public deployment decision.
