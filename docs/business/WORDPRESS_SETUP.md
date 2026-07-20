# Asteria Production WordPress Setup Plan

## Purpose

This document defines the minimum production WordPress environment for the Asteria Pets Magazine. It is an operational plan, not a deployment record. Every generated article remains a draft until a named human editor reviews and manually publishes it.

## Recommended Managed Hosting

Use **Kinsta Managed WordPress in the Seoul data center** for Asteria v1, subject to a final procurement, current-price, data-processing, and support review before purchase.

The recommendation is based on the operational needs already defined for Asteria: a managed WordPress service, a Seoul location, separate staging, infrastructure security, daily backups, CDN, page caching, and image optimization. Kinsta documents a Seoul data center, managed infrastructure protections, and these operational services. Do not install WordPress plugins that duplicate host-provided caching, CDN, backup, or infrastructure security without a measured gap and compatibility review.

This is the approved planning baseline, not authorization to purchase or deploy. If procurement rejects Kinsta, compare alternatives against the same requirements before selecting a replacement; do not silently downgrade backup, staging, security, or recovery capabilities.

## Environment Boundary

- Production is the only indexable environment and uses the canonical public domain.
- Staging uses a separate host-provided environment or subdomain, is access-controlled, and is excluded from search indexing and analytics.
- Local development and disposable WordPress validation remain separate from production.
- Production credentials are never reused in local, staging, documentation, source control, screenshots, or support messages.
- Asteria connects only through HTTPS with a dedicated WordPress user and a dedicated Application Password.
- Asteria may create or update its own drafts. It must never publish, schedule, or delete public content.

## Must Have

Everything in this section is required before the first public article.

### 1. Hosting And Domain Strategy

- [ ] Procure a Kinsta Managed WordPress plan that supports the expected v1 traffic and a Seoul data center.
- [ ] Confirm current price, renewal terms, traffic and bandwidth limits, overage policy, backup retention, support scope, data processing terms, and exit/export procedure before purchase.
- [ ] Create separate production and staging environments.
- [ ] Keep the domain registrar independent from the hosting account to reduce single-account failure risk.
- [ ] Select one short, brandable canonical domain after trademark and availability checks. Prefer a domain that remains valid if the magazine expands beyond cats.
- [ ] Choose either the apex domain or `www` as canonical; permanently redirect the other and every owned alternate domain to it.
- [ ] Enable registrar lock, automatic renewal, recovery contacts, and DNSSEC when supported by the registrar and DNS provider.
- [ ] Limit registrar and DNS access to named owners with individual accounts and two-factor authentication.
- [ ] Use host-managed TLS, force HTTPS, and verify renewal and HTTP-to-HTTPS redirects.
- [ ] Keep staging on a non-public hostname with authentication and `noindex`; do not rely on `robots.txt` alone for confidentiality.

**Launch evidence:** canonical domain, HTTPS, redirects, access-controlled staging, registrar ownership, and renewal settings are recorded in the private operations register.

### 2. Required Plugins

Install only the following plugins after confirming compatibility with the selected plan and current supported WordPress/PHP versions:

| Plugin | Purpose | Rule |
| --- | --- | --- |
| Yoast SEO | Titles, descriptions, canonical metadata, schema, and XML sitemap control | Use one SEO plugin only. Disable overlapping SEO features elsewhere. |
| Site Kit by Google | Connect Search Console and Google Analytics and display authorized reporting | Connect production only. Configure consent before analytics collection where required. |
| WP Mail SMTP | Route WordPress transactional mail through a dedicated provider | Use a provider API or authenticated SMTP; never use a personal mailbox password. |
| WordPress-admin 2FA plugin | Protect human WordPress accounts if the host does not provide WordPress-login 2FA | Select one maintained, compatible plugin during setup; host-dashboard 2FA does not automatically protect WordPress login. |

Do **not** add a caching plugin, CDN plugin, backup plugin, image-optimization plugin, firewall suite, page builder, affiliate plugin, editorial workflow plugin, or analytics plugin by default. Add one only when an approved gap cannot be met by the host or the required plugins above.

**Plugin control:** record owner, purpose, license, update policy, data access, and removal procedure for every active plugin. Remove inactive plugins and unused themes rather than leaving them disabled.

### 3. Security

- [ ] Use unique named accounts; shared Administrator or Editor accounts are prohibited.
- [ ] Require strong unique passwords and two-factor authentication for the registrar, DNS, hosting, WordPress Administrators, and WordPress Editors.
- [ ] Keep only one or two named Administrators. Administrators do not perform routine writing or publishing from their privileged accounts.
- [ ] Apply WordPress core, theme, and plugin security updates through staging or a host-supported update process with a pre-update backup and rollback path.
- [ ] Use only supported themes and plugins from trusted sources; prohibit nulled or unlicensed packages.
- [ ] Keep the host WAF, DDoS protection, TLS, and security monitoring enabled.
- [ ] Review WordPress users, Application Passwords, plugins, themes, and administrator activity monthly and immediately after personnel changes.
- [ ] Revoke access on role change or departure; rotate any credential suspected of exposure.
- [ ] Never place passwords, Application Passwords, API keys, recovery codes, or SMTP credentials in Git, WordPress content, analytics, documentation, or browser exports.
- [ ] Maintain a private incident contact list and a procedure to put the site into a safe holding state, revoke credentials, restore a known-good backup, and communicate corrections.

### 4. Backup And Recovery

- [ ] Enable and verify the host's automatic daily file-and-database backups.
- [ ] Confirm the purchased plan's actual retention period; do not assume a period from this planning document.
- [ ] Create a manual restore point before domain changes, plugin/theme updates, bulk edits, or staging-to-production actions.
- [ ] Name an owner for backup monitoring and restoration approval.
- [ ] Set the initial recovery targets: maximum acceptable data loss of 24 hours and restoration target of 4 hours during staffed operations. Reassess after traffic or publishing frequency increases.
- [ ] Perform one full restore into staging before launch and record the result, duration, missing configuration, and corrective action.
- [ ] Verify that restored domains, redirects, SMTP, analytics, SEO metadata, media, and Asteria draft access behave correctly.
- [ ] Preserve a clean export path for WordPress files, media, and database so the site can leave the hosting provider.

Host backups are necessary but are not proof of recovery. Launch remains blocked until a staging restore succeeds.

### 5. Caching And Performance

- [ ] Use Kinsta page cache, CDN, and edge/cache controls supplied by the host.
- [ ] Do not install a second page-cache or CDN plugin.
- [ ] Ensure WordPress admin, login, preview, authenticated sessions, and draft workflows are not publicly cached.
- [ ] Purge the relevant cache after publishing, correcting, or materially updating an article.
- [ ] Test the home page, category pages, article pages, sitemap, RSS, 404 page, preview, and draft editing on mobile and desktop.
- [ ] Record baseline Core Web Vitals and page weight for the home page and a representative article before launch.

### 6. SEO Plugin And Search Foundations

- [ ] Configure Yoast SEO as the single SEO plugin.
- [ ] Set the site name, organization identity, canonical domain, title patterns, default social image, and article schema.
- [ ] Generate one production XML sitemap and verify it contains only canonical, public, indexable URLs.
- [ ] Exclude staging, drafts, previews, attachment-only pages, internal search results, and thin archives from indexing.
- [ ] Verify unique title, meta description, canonical URL, Open Graph metadata, and schema on a representative article.
- [ ] Keep WordPress RSS available for published posts and confirm it contains no draft or internal review data.
- [ ] Keep `robots.txt` crawlable and ensure it does not block required CSS, JavaScript, images, or the sitemap.

### 7. Analytics

- [ ] Create an organization-owned Google account and GA4 property; do not tie production measurement to one person's private account.
- [ ] Connect Site Kit by Google to the production property with the minimum necessary permissions.
- [ ] Exclude staging and internal preview traffic from production reporting.
- [ ] Define the v1 measurement set: users, organic sessions, landing pages, engagement, outbound affiliate clicks when introduced, and contact submissions.
- [ ] Prevent article drafts, API credentials, email content, search terms containing personal data, and form-body content from entering analytics events or URLs.
- [ ] Complete privacy and consent review before analytics collection begins; document retention and deletion settings.
- [ ] Verify one production page view and one excluded internal/staging view before launch.

### 8. Google Search Console

- [ ] Create a domain property owned by the organization and verify it through DNS.
- [ ] Give at least two named owners access; keep permissions at the minimum needed.
- [ ] Submit the canonical XML sitemap after the first public page exists.
- [ ] Inspect the home page and first article, verify canonical selection and indexing eligibility, and record any coverage errors.
- [ ] Route security, manual-action, indexing, and structured-data notifications to an actively monitored address.
- [ ] Review indexing and query data weekly as defined in the Editorial Playbook.

### 9. Naver Search Advisor

- [ ] Register the canonical production domain and complete ownership verification using an organization-controlled method.
- [ ] Record the annual ownership re-verification owner and reminder.
- [ ] Submit the production sitemap after public URLs exist. Prefer the sitemap as the primary content feed.
- [ ] Submit RSS only after at least one public post exists and confirm every feed URL uses the verified domain.
- [ ] Verify that the sitemap and RSS contain published canonical URLs only and expose no draft, preview, staging, or review data.
- [ ] Review collection, optimization, and exposure reports weekly during launch.

### 10. SMTP

- [ ] Select a transactional email provider with organization ownership, Korean delivery suitability, clear limits, and an exit path.
- [ ] Connect it through WP Mail SMTP using a provider API or dedicated credential stored outside source control.
- [ ] Use a domain-aligned From address and configure SPF, DKIM, and DMARC with the DNS owner.
- [ ] Test password reset, contact form delivery, security alerts, and administrative notices to two receiving domains.
- [ ] Set a monitored reply-to and failure/alert recipient.
- [ ] Log delivery metadata only as needed; do not retain message bodies or credentials in routine logs.
- [ ] Do not rely on unauthenticated PHP mail or a personal Gmail/Naver account for production sending.

### 11. Image Optimization And Rights

- [ ] Enable the host CDN and choose lossless or measured lossy image optimization after visual review. Kinsta's CDN can generate and serve WebP variants, so do not add a duplicate optimizer initially.
- [ ] Upload appropriately sized source files; do not use full-resolution originals when the rendered size is smaller.
- [ ] Verify mobile and desktop crops, focal point, social preview, captions, and alt text.
- [ ] Remove unnecessary EXIF and private location metadata.
- [ ] Maintain a rights record for every image: creator, source, acquisition date, license, commercial-use rights, modification rights, and required attribution.
- [ ] Reject images with unclear rights, misleading pet handling, unsafe situations, private information, or hidden credentials.

### 12. Required WordPress Pages

Create, human-review, and link the following pages from the public footer or another persistent location before launch:

| Page | Minimum content |
| --- | --- |
| About | Magazine mission, intended audience, editorial ownership, and scope. |
| Contact | Monitored contact method and expected response path without exposing a personal address. |
| Privacy Policy | Data collected, purposes, processors, cookies, retention, rights, contact, and effective date. |
| Editorial Policy | Sourcing, human review, pet-safety standard, corrections, conflicts, and update practice. |
| AI Disclosure | How AI assists drafting and how human review controls public publication. It may be a clearly labeled section of Editorial Policy. |
| Corrections And Reporting | How readers report errors or unsafe advice and how corrections are handled. It may be combined with Editorial Policy if directly linkable. |
| Image Credits And Copyright | Rights policy, attribution practice, and infringement contact. |
| Affiliate Disclosure | Required before the first affiliate link or compensated recommendation; publish at launch if affiliate content is planned immediately. |

Terms of Use are required only after legal review determines the site's services or risk profile needs them. Page text must be reviewed for the actual business, jurisdiction, processors, and practices; template text alone is not launch-ready.

### 13. User Roles

| Role | Assignment | Allowed use |
| --- | --- | --- |
| Administrator | One or two named technical/business owners | Configuration, users, plugins, themes, recovery. Not routine editorial work. |
| Editor | Founder and named human publishing editors | Review, edit, schedule when approved, and manually publish content. |
| Author | Optional named human writers | Create and manage their own content only when the operating model needs it. |
| Contributor | Dedicated Asteria integration user | Create and edit its own text drafts without publishing. |

- [ ] Do not grant Asteria Administrator, Editor, or Author.
- [ ] Do not share accounts between people or between Asteria and a person.
- [ ] Do not enable Subscriber registration for v1.
- [ ] Review the effective capabilities in staging before production connection; plugin changes can alter role behavior.

### 14. Publishing Permissions

- [ ] Create a dedicated `asteria-draft` user with the Contributor role and a non-personal operational email address.
- [ ] Create one Application Password named for the production Asteria integration. Store it only in the approved secret store or production environment configuration.
- [ ] Confirm the Application Password works only over HTTPS and can be revoked without affecting human login.
- [ ] Test that Asteria can create and update its own draft title, body, and excerpt where mapped.
- [ ] Test that Asteria cannot publish, schedule, edit others' posts, delete public posts, manage users, change settings, install plugins/themes, or access unrelated credentials.
- [ ] Keep media upload disabled for the integration account in v1. A named human uploads and verifies licensed images.
- [ ] Require a named Editor to compare the WordPress draft with the approved Asteria working copy and complete the Editorial Playbook checks.
- [ ] Only a named human Editor or Administrator may press Publish. An Asteria response, review score, draft creation, or Application Password never constitutes publishing approval.
- [ ] Revoke and replace the Application Password after suspected exposure, responsible-owner change, or scheduled credential review.

**Go-live permission test:** in staging, demonstrate one successful Asteria draft creation and one denied public-publish attempt without changing the integration role. Production remains blocked if public publishing is possible through the integration credential.

## Should Have

These controls should be completed at launch when practical and no later than the first 30 days.

### Resilience And Operations

- [ ] Add a weekly offsite backup of files and database to an organization-owned storage account independent of the hosting failure domain.
- [ ] Run a quarterly restore exercise and after every material hosting, theme, or workflow change.
- [ ] Maintain a private asset register for domain, DNS, hosting, WordPress, analytics, search tools, SMTP, plugins, renewal dates, owners, and recovery contacts.
- [ ] Configure external uptime checks for the home page, a representative article, sitemap, RSS, and certificate expiry.
- [ ] Define incident severity, owner, response time, correction process, and reader communication template.
- [ ] Review host capacity and plan limits monthly during the first 90 days.

### Editorial And Search Operations

- [ ] Add a maintained redirect manager only if the host and SEO plugin cannot provide a usable redirect workflow.
- [ ] Define slug conventions and a redirect requirement before changing any published URL.
- [ ] Create category landing pages only when each has a clear purpose and enough published content.
- [ ] Record Google and Naver indexing anomalies, corrections, and ownership re-verification dates in the private operations register.
- [ ] Add a reusable featured-image specification covering dimensions, safe crop, attribution, and social preview.

### Security And Deliverability

- [ ] Run a quarterly user, role, Application Password, DNS, plugin, and recovery-access audit.
- [ ] Add DMARC reporting and tighten the policy after SPF/DKIM alignment is stable.
- [ ] Configure a backup SMTP connection only after the primary delivery path is measured and documented.
- [ ] Test account recovery without relying on one person, device, or email inbox.

## Future

These items require measured need, revenue, traffic, or a separately approved operational change. They are not launch blockers.

### Scale And Reliability

- Consider more frequent backups only when publishing frequency, comments, transactions, or other changing data make the 24-hour recovery point inadequate.
- Add advanced performance tooling only after real-user data identifies a specific bottleneck.
- Add a second CDN, image service, or optimization plugin only if it replaces rather than conflicts with the host stack and passes a staging benchmark.
- Evaluate a provider-independent disaster-recovery environment when revenue or availability requirements justify the cost.

### Roles And Workflow

- Create a custom `asteria_draft_writer` role only if Contributor becomes insufficient. Add only the exact capabilities required, such as `upload_files` after image-rights controls exist, and continue to exclude `publish_posts` and all administrative capabilities.
- Add an editorial workflow or audit plugin only when the current named-human checklist and WordPress revisions no longer provide sufficient traceability.
- Add additional Authors or Editors only with a documented responsibility, owner approval, two-factor authentication, and periodic review.
- Do not enable automated public publishing without a separate product, security, and editorial approval process.

### Growth And Monetization

- Connect AdSense or affiliate measurement only after privacy, consent, disclosure, and editorial-independence requirements are complete.
- Add newsletter, membership, commerce, or digital-product plugins only through separate business validation and security review.
- Build cross-channel dashboards only after Google Analytics, Search Console, and Naver data are stable enough to support decisions.

## Launch Decision Gate

Recommend **GO** only when every Must Have item has evidence, the staging restore succeeds, the integration account is proven unable to publish, required public pages have human/legal review appropriate to the business, and the named owner signs off on domain, security, backup, analytics, search, SMTP, and editorial readiness.

Any unmet Must Have item is **HOLD**. Should Have and Future items do not block launch unless a risk review promotes one to Must Have for the actual production context.

## Official References

- [Kinsta WordPress Hosting](https://kinsta.com/docs/wordpress-hosting/)
- [Kinsta Data Center Locations](https://kinsta.com/docs/service-information/data-center-locations/)
- [Kinsta Backups](https://kinsta.com/docs/wordpress-hosting/wordpress-backups/)
- [Kinsta Caching](https://kinsta.com/docs/wordpress-hosting/caching/)
- [Kinsta CDN And Image Optimization](https://kinsta.com/docs/wordpress-hosting/wordpress-cdn/kinsta-cdn/)
- [WordPress Roles And Capabilities](https://wordpress.org/documentation/article/roles-and-capabilities/)
- [WordPress Application Passwords](https://developer.wordpress.org/advanced-administration/security/application-passwords/)
- [Yoast SEO Plugin](https://wordpress.org/plugins/wordpress-seo/)
- [Site Kit By Google](https://wordpress.org/plugins/google-site-kit/)
- [WP Mail SMTP](https://wordpress.org/plugins/wp-mail-smtp/)
- [Naver Search Advisor Ownership Verification](https://help.naver.com/service/30010/contents/17591?lang=ko&osType=PC)
- [Naver Search Advisor RSS And Sitemap Submission](https://searchadvisor.naver.com/guide/request-feed)
