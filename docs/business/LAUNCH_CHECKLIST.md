# Asteria Pets Magazine Launch Checklist

Complete every applicable item before the first public article is announced. Attach the responsible owner and verification evidence in the launch ticket or operating record.

## Domain And Access

- [ ] Register or confirm the production domain.
- [ ] Confirm domain ownership and renewal contact details.
- [ ] Enable automatic domain renewal and verify the payment method.
- [ ] Point DNS records to the production host.
- [ ] Confirm HTTPS works on the canonical domain without certificate warnings.
- [ ] Redirect HTTP and alternate hostnames to one canonical HTTPS hostname.
- [ ] Store registrar, DNS, hosting, analytics, and publishing access in the approved password manager.
- [ ] Confirm at least two authorized people can recover critical production access.

## Analytics

- [ ] Create the production analytics property.
- [ ] Install analytics only after the privacy and consent requirements are satisfied.
- [ ] Exclude internal or test traffic where practical.
- [ ] Verify a production page view appears in the real-time report.
- [ ] Define tracked events for outbound affiliate clicks, contact actions, and email or RSS subscriptions where applicable.
- [ ] Confirm analytics does not collect API keys, credentials, article drafts, or unnecessary personal data.

## Search Console

- [ ] Verify the canonical production domain in Google Search Console.
- [ ] Verify the appropriate Naver Search Advisor property.
- [ ] Submit the production sitemap.
- [ ] Inspect the homepage and first public article URL.
- [ ] Confirm no draft, preview, admin, or local URL is submitted for indexing.
- [ ] Record the account owner responsible for coverage and manual-action alerts.

## Sitemap, Robots, And Canonicals

- [ ] Confirm `/sitemap.xml` loads successfully on the production domain.
- [ ] Confirm the sitemap contains only canonical, public, indexable URLs.
- [ ] Confirm each sitemap URL returns a successful response and uses HTTPS.
- [ ] Confirm `/robots.txt` loads successfully.
- [ ] Confirm robots rules allow intended articles and block private, admin, preview, and internal search pages where applicable.
- [ ] Confirm `robots.txt` references the production sitemap.
- [ ] Confirm every public page has the correct self-referencing canonical URL.
- [ ] Confirm staging and preview environments are not indexable.

## RSS

- [ ] Confirm the production RSS feed loads successfully.
- [ ] Validate the feed format.
- [ ] Confirm feed titles, dates, canonical links, and descriptions are correct.
- [ ] Confirm the first public article appears once in the feed.
- [ ] Add feed discovery metadata to public pages where supported.

## Required Pages

- [ ] Publish a Privacy Policy naming the site operator, collected data, analytics, cookies, contact method, and retention approach.
- [ ] Publish an About page explaining the magazine mission, audience, editorial responsibility, and human-review process.
- [ ] Publish a Contact page with a tested contact method.
- [ ] Add a process for correction, copyright, privacy, and safety reports.
- [ ] Confirm required business or operator information is displayed for the applicable jurisdiction.
- [ ] Link Privacy, About, and Contact pages from the site footer.

## Editorial And AI Disclosure

- [ ] Add a clear AI-assistance disclosure that accurately describes generation and human review.
- [ ] Confirm the disclosure does not imply that AI output is independently verified when it is not.
- [ ] Identify the human editorial owner on each public article or editorial policy page.
- [ ] Display publication and update dates.
- [ ] Confirm medical, nutritional, toxicology, and safety claims have authoritative sources and appropriate professional-care guidance.
- [ ] Confirm the first article completed the Magazine Profile quality checklist and has explicit human publishing approval.
- [ ] Confirm no internal prompt, provider metadata, draft review note, or API response detail is visible publicly.

## Image Copyright And Accessibility

- [ ] Confirm every launch image has documented ownership, license, permission, or original-creation evidence.
- [ ] Record the image source, creator, license, acquisition date, and required attribution.
- [ ] Confirm commercial use and modification are allowed where applicable.
- [ ] Remove images with missing or ambiguous rights.
- [ ] Add required attribution in the correct location.
- [ ] Confirm images do not expose private information, credentials, addresses, or identifying metadata.
- [ ] Add descriptive alt text where the image conveys information.
- [ ] Confirm decorative images use empty alt text where appropriate.

## Monetization And Disclosures

- [ ] Confirm the first article contains no accidental affiliate or advertising links.
- [ ] If affiliate links are present, publish a clear disclosure near the recommendation and before the first affiliate link.
- [ ] Confirm every commercial recommendation explains its relevance and limitations.
- [ ] Verify affiliate destination URLs, tracking, availability, and pricing language.
- [ ] Confirm sponsored content is visibly labeled before publication.
- [ ] Confirm ads, if enabled, do not cover content, imitate navigation, or interrupt safety guidance.

## Backup And Recovery

- [ ] Enable automated backups for production content, media, and required configuration.
- [ ] Confirm backup frequency and retention meet the recovery requirement.
- [ ] Store backups separately from the production host.
- [ ] Encrypt backups containing personal or access-related data.
- [ ] Perform one restore test before launch.
- [ ] Record the restore owner and recovery steps.

## Monitoring

- [ ] Enable uptime monitoring for the homepage, first article, sitemap, robots file, and RSS feed.
- [ ] Enable alerts for certificate expiry, server errors, and sustained downtime.
- [ ] Confirm alert recipients and escalation contacts.
- [ ] Verify error logs do not contain credentials, API keys, or unnecessary personal data.
- [ ] Establish a weekly broken-link check.
- [ ] Establish a monthly Search Console coverage and security review.
- [ ] Test one alert and confirm it reaches the responsible person.

## Final Public-Launch Verification

- [ ] Review the production homepage and first article on mobile and desktop.
- [ ] Confirm navigation, footer links, images, internal links, and contact actions work.
- [ ] Confirm page title, meta description, canonical URL, sharing preview, and structured metadata are correct.
- [ ] Confirm the public article matches the human-approved working copy.
- [ ] Confirm no draft or private content is publicly accessible.
- [ ] Confirm analytics, Search Console, sitemap, robots, RSS, backup, and monitoring checks are complete.
- [ ] Record the final PUBLISH or HOLD decision and approver in the Operation Log.
