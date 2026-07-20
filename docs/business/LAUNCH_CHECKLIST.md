# Asteria Pets Magazine Launch Checklist

Complete every applicable item before the first public article is announced. Attach the responsible owner and verification evidence in the launch ticket or operating record.

Status review date: 2026-07-20

- **READY:** Verified by current repository or operating evidence.
- **BLOCKED:** Required for launch but verification evidence is missing. The blocker code maps to the minimum action in the Blocker Register.
- **NOT_APPLICABLE:** Intentionally excluded from the first public launch scope.

## Domain And Access

- **BLOCKED (B01)** Register or confirm the production domain.
- **BLOCKED (B01)** Confirm domain ownership and renewal contact details.
- **BLOCKED (B01)** Enable automatic domain renewal and verify the payment method.
- **BLOCKED (B01)** Point DNS records to the production host.
- **BLOCKED (B01)** Confirm HTTPS works on the canonical domain without certificate warnings.
- **BLOCKED (B01)** Redirect HTTP and alternate hostnames to one canonical HTTPS hostname.
- **BLOCKED (B01)** Store registrar, DNS, hosting, analytics, and publishing access in the approved password manager.
- **BLOCKED (B01)** Confirm at least two authorized people can recover critical production access.

## Analytics

- **BLOCKED (B02)** Create the production analytics property.
- **BLOCKED (B02)** Install analytics only after the privacy and consent requirements are satisfied.
- **BLOCKED (B02)** Exclude internal or test traffic where practical.
- **BLOCKED (B02)** Verify a production page view appears in the real-time report.
- **BLOCKED (B02)** Define tracked events for outbound affiliate clicks, contact actions, and email or RSS subscriptions where applicable.
- **BLOCKED (B02)** Confirm analytics does not collect API keys, credentials, article drafts, or unnecessary personal data.

## Search Console

- **BLOCKED (B03)** Verify the canonical production domain in Google Search Console.
- **BLOCKED (B03)** Verify the appropriate Naver Search Advisor property.
- **BLOCKED (B03)** Submit the production sitemap.
- **BLOCKED (B03)** Inspect the homepage and first public article URL.
- **BLOCKED (B03)** Confirm no draft, preview, admin, or local URL is submitted for indexing.
- **BLOCKED (B03)** Record the account owner responsible for coverage and manual-action alerts.

## Sitemap, Robots, And Canonicals

- **BLOCKED (B04)** Confirm `/sitemap.xml` loads successfully on the production domain.
- **BLOCKED (B04)** Confirm the sitemap contains only canonical, public, indexable URLs.
- **BLOCKED (B04)** Confirm each sitemap URL returns a successful response and uses HTTPS.
- **BLOCKED (B04)** Confirm `/robots.txt` loads successfully.
- **BLOCKED (B04)** Confirm robots rules allow intended articles and block private, admin, preview, and internal search pages where applicable.
- **BLOCKED (B04)** Confirm `robots.txt` references the production sitemap.
- **BLOCKED (B04)** Confirm every public page has the correct self-referencing canonical URL.
- **BLOCKED (B04)** Confirm staging and preview environments are not indexable.

## RSS

- **BLOCKED (B05)** Confirm the production RSS feed loads successfully.
- **BLOCKED (B05)** Validate the feed format.
- **BLOCKED (B05)** Confirm feed titles, dates, canonical links, and descriptions are correct.
- **BLOCKED (B05)** Confirm the first public article appears once in the feed.
- **BLOCKED (B05)** Add feed discovery metadata to public pages where supported.

## Required Pages

- **BLOCKED (B06)** Publish a Privacy Policy naming the site operator, collected data, analytics, cookies, contact method, and retention approach.
- **BLOCKED (B06)** Publish an About page explaining the magazine mission, audience, editorial responsibility, and human-review process.
- **BLOCKED (B06)** Publish a Contact page with a tested contact method.
- **BLOCKED (B06)** Add a process for correction, copyright, privacy, and safety reports.
- **BLOCKED (B06)** Confirm required business or operator information is displayed for the applicable jurisdiction.
- **BLOCKED (B06)** Link Privacy, About, and Contact pages from the site footer.

## Editorial And AI Disclosure

- **BLOCKED (B07)** Add a clear AI-assistance disclosure that accurately describes generation and human review.
- **BLOCKED (B07)** Confirm the disclosure does not imply that AI output is independently verified when it is not.
- **BLOCKED (B07)** Identify the human editorial owner on each public article or editorial policy page.
- **BLOCKED (B07)** Display publication and update dates.
- **BLOCKED (B07)** Confirm medical, nutritional, toxicology, and safety claims have authoritative sources and appropriate professional-care guidance.
- **BLOCKED (B07)** Confirm the first article completed the Magazine Profile quality checklist and has explicit human publishing approval.
- **BLOCKED (B07)** Confirm no internal prompt, provider metadata, draft review note, or API response detail is visible publicly.

## Image Copyright And Accessibility

- **BLOCKED (B08)** Confirm every launch image has documented ownership, license, permission, or original-creation evidence.
- **BLOCKED (B08)** Record the image source, creator, license, acquisition date, and required attribution.
- **BLOCKED (B08)** Confirm commercial use and modification are allowed where applicable.
- **BLOCKED (B08)** Remove images with missing or ambiguous rights.
- **BLOCKED (B08)** Add required attribution in the correct location.
- **BLOCKED (B08)** Confirm images do not expose private information, credentials, addresses, or identifying metadata.
- **BLOCKED (B08)** Add descriptive alt text where the image conveys information.
- **BLOCKED (B08)** Confirm decorative images use empty alt text where appropriate.

## Monetization And Disclosures

- **READY** Confirm the first article contains no accidental affiliate or advertising links. Verified in `generated/pets/001-adoption-responsibilities.md`.
- **NOT_APPLICABLE** If affiliate links are present, publish a clear disclosure near the recommendation and before the first affiliate link. Affiliate links are excluded from the first launch article.
- **NOT_APPLICABLE** Confirm every commercial recommendation explains its relevance and limitations. Commercial recommendations are excluded from the first launch article.
- **NOT_APPLICABLE** Verify affiliate destination URLs, tracking, availability, and pricing language. Affiliate destinations are excluded from the first launch article.
- **NOT_APPLICABLE** Confirm sponsored content is visibly labeled before publication. The first launch article is not sponsored.
- **NOT_APPLICABLE** Confirm ads, if enabled, do not cover content, imitate navigation, or interrupt safety guidance. Ads are disabled for the first launch.

## Backup And Recovery

- **BLOCKED (B09)** Enable automated backups for production content, media, and required configuration.
- **BLOCKED (B09)** Confirm backup frequency and retention meet the recovery requirement.
- **BLOCKED (B09)** Store backups separately from the production host.
- **BLOCKED (B09)** Encrypt backups containing personal or access-related data.
- **BLOCKED (B09)** Perform one restore test before launch.
- **BLOCKED (B09)** Record the restore owner and recovery steps.

## Monitoring

- **BLOCKED (B10)** Enable uptime monitoring for the homepage, first article, sitemap, robots file, and RSS feed.
- **BLOCKED (B10)** Enable alerts for certificate expiry, server errors, and sustained downtime.
- **BLOCKED (B10)** Confirm alert recipients and escalation contacts.
- **BLOCKED (B10)** Verify error logs do not contain credentials, API keys, or unnecessary personal data.
- **BLOCKED (B10)** Establish a weekly broken-link check.
- **BLOCKED (B10)** Establish a monthly Search Console coverage and security review.
- **BLOCKED (B10)** Test one alert and confirm it reaches the responsible person.

## Final Public-Launch Verification

- **BLOCKED (B11)** Review the production homepage and first article on mobile and desktop.
- **BLOCKED (B11)** Confirm navigation, footer links, images, internal links, and contact actions work.
- **BLOCKED (B11)** Confirm page title, meta description, canonical URL, sharing preview, and structured metadata are correct.
- **BLOCKED (B11)** Confirm the public article matches the human-approved working copy.
- **BLOCKED (B11)** Confirm no draft or private content is publicly accessible.
- **BLOCKED (B11)** Confirm analytics, Search Console, sitemap, robots, RSS, backup, and monitoring checks are complete.
- **BLOCKED (B11)** Record the final PUBLISH or HOLD decision and approver in the Operation Log.

## Blocker Register

Every BLOCKED checklist item references one entry below. Resolving a blocker does not automatically mark its items READY; attach verification evidence and review each item again.

| Blocker | Why blocked | Minimum action required |
| --- | --- | --- |
| B01 | No production domain, hosting target, DNS, HTTPS, credential-custody, or recovery evidence exists in the current operating record. | Choose the production host and domain, configure DNS and HTTPS redirects, document renewal, store access securely, and verify two recovery contacts. |
| B02 | No production analytics property, consent decision, event plan, or verified production traffic evidence exists. | Approve the privacy/consent approach, create and configure analytics, exclude test traffic, verify real-time data, and document the data collected. |
| B03 | No canonical production domain or verified Google Search Console and Naver Search Advisor properties exist. | Verify both search properties after the domain is live, submit the production sitemap, inspect public URLs, and assign an alert owner. |
| B04 | The repository and operating evidence contain no production sitemap, robots file, canonical verification, or indexing controls. | Provide production sitemap and robots endpoints, add correct canonicals and staging protections, then validate every public URL over HTTPS. |
| B05 | No production RSS endpoint, feed validation, article entry, or discovery metadata exists. | Publish and validate an RSS feed, add discovery metadata, and confirm the first article appears once with correct canonical data. |
| B06 | Privacy, About, Contact, reporting-process, jurisdictional operator details, and footer links are not published. | Approve the operator details and policies, publish and test all required pages and reporting routes, then link them from the footer. |
| B07 | No public disclosure/editorial page exists, no human editor is named, source verification is incomplete, article 001 lacks explicit human PUBLISH approval, and the stored draft includes internal run metadata. | Assign a human editor, verify sources and the quality checklist, approve a public-safe copy, publish accurate AI/editorial disclosures and dates, and remove internal metadata from the public version. |
| B08 | No final launch image or rights, attribution, privacy, and alt-text evidence has been selected. | Select the launch image, document its rights and attribution, inspect privacy metadata, and approve accessible alt text before upload. |
| B09 | No production backup policy, separate backup destination, encryption decision, restore test, or recovery owner is documented. | Configure automated separate backups, define retention and encryption, run a restore test, and record the owner and recovery steps. |
| B10 | No production uptime, certificate, server-error, log-safety, broken-link, Search Console, or alert-delivery evidence exists. | Configure the required monitors and schedules, assign recipients, inspect logging safety, and complete one successful alert test. |
| B11 | There is no production deployment to verify, prerequisite launch systems remain blocked, and the Operation Log records HOLD without a named approver. | Resolve B01-B10, deploy the approved article, complete mobile/desktop and metadata QA, verify public/private boundaries, and record a named final PUBLISH or HOLD decision. |
