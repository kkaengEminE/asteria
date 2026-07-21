# Asteria Pets Magazine Editorial Playbook

## Purpose

This playbook defines how the existing Asteria editorial process is operated each week. It does not replace the Magazine Profile, Editorial Calendar, Launch Checklist, or Operation Log. When guidance conflicts, animal safety, factual accuracy, explicit human approval, and the current HOLD/PUBLISH decision take precedence over publishing volume.

> **Publishing update — 2026-07-21:** Astro + Cloudflare Pages is the active v1 path. References below to WordPress draft transfer are superseded by the checksum-pinned approval manifest and Astro build process in `docs/business/ASTRO_PUBLISHING.md`. The WordPress adapter is deprecated and inactive.

## Operating Principles

- Treat every generated package as a draft, regardless of automated quality or review scores.
- Publish only after a named human editor completes review and records an explicit decision.
- Keep Asteria generation and editing separate from public WordPress publication.
- Keep public publishing manual for v1; Asteria may prepare an approved static build but must not deploy publicly.
- Measure editing time and repeated problems rather than guessing where the process is slow.
- Record each real editorial run in `docs/operations/OPERATION_LOG.md` using only its six approved fields.
- Do not change prompts, workflow, architecture, or product behavior from an isolated result. Open a separately approved task when repeated evidence supports a change.

## 1. Weekly Publishing Workflow

The default first-90-day cadence is three articles per week. Reduce the cadence when source verification, editing, image rights, or launch checks cannot be completed safely.

### Monday: Plan The Batch

1. Select the next eligible P1 article from `docs/magazines/pets/EDITORIAL_CALENDAR.md`.
2. Select up to two supporting or seasonal articles, keeping commercial-intent content within the Business Plan limit.
3. For each article, record the target reader, primary search intent, content category, desired reader action, required sources, safety concerns, and internal-link candidates.
4. Confirm that prerequisite foundation articles are already published or scheduled in the same batch.
5. Assign the human editor and intended publication day.

**Completion condition:** No more than three briefs are approved, each has one clear search intent, and every safety-sensitive brief has an authoritative sourcing plan.

### Tuesday: Generate And Triage

1. Generate each approved topic through the existing Asteria workflow.
2. Confirm Article, Summary, SEO, FAQ, and Editorial Review are present.
3. Reject incomplete, malformed, off-topic, wrong-species, or unsafe output before line editing.
4. Record the start of measured editing time when a viable draft enters human review.
5. Keep failed attempts and provider errors out of the publishable working copy.

**Completion condition:** Each retained draft is structurally complete and assigned PASS, WARNING, FAIL, or REJECTED for human review triage.

### Wednesday: Human Edit And Source Review

1. Complete the Human Review Checklist below.
2. Rewrite generic introductions, repeated conclusions, awkward Korean, abstract advice, and unsupported claims.
3. Verify health, nutrition, toxicology, safety, legal, and product claims against current authoritative sources.
4. Confirm professional-care thresholds are clear where symptoms, injury, toxicity, pain, or persistent distress may be involved.
5. Complete the SEO and Image Checklists.
6. Stop measured editing time when the article is ready for the publishing decision.

**Completion condition:** The editor can identify every material source, all checklist exceptions are resolved or documented, and the article has an explicit REVISE, REJECT, or READY_FOR_DRAFT decision.

### Thursday: WordPress Draft And Final QA

1. Send only the approved working copy to WordPress as a draft.
2. Compare the WordPress title, body, summary/excerpt, SEO fields, links, FAQ, and image with the approved Asteria copy.
3. Remove internal run metadata, prompt details, provider details, review notes, and draft-only text.
4. Complete the Publish Checklist in WordPress preview on mobile and desktop.
5. Record the named editor's PUBLISH, HOLD, REVISE, or REJECT decision.

**Completion condition:** A public-safe WordPress draft matches the approved copy and has a named human decision. PUBLISH means permission to publish manually; it does not authorize automated publishing.

### Friday: Publish, Verify, And Review

1. A named human editor manually publishes only articles with a PUBLISH decision.
2. Complete the Post-Publication Checklist immediately after publication.
3. Record the editorial run in the Operation Log, including measured editing time and improvement notes.
4. Complete the Weekly KPI Review for available data.
5. Carry unresolved items into the next weekly plan as HOLD or REVISE work before adding replacement volume.

**Completion condition:** Every published URL is verified and monitored; every unpublished draft has a recorded disposition; the Operation Log is complete.

## 2. Human Review Checklist

### Reader And Scope

- [ ] The article addresses the approved topic, species, life stage, and reader situation.
- [ ] The direct answer or decision frame appears near the beginning.
- [ ] The article stays within one primary search intent.
- [ ] Advice distinguishes relevant differences in age, health, temperament, or environment.
- [ ] The title accurately represents the edited article.

### Accuracy And Safety

- [ ] Every factual claim needed for the reader's decision is supported or removed.
- [ ] Health, nutrition, toxicology, safety, and legal claims use current authoritative sources.
- [ ] The article does not diagnose, prescribe, promise a cure, or guarantee an outcome.
- [ ] Warning signs and professional-care thresholds are specific where relevant.
- [ ] The advice excludes punishment, coercion, unsafe restraint, and fear-based handling.
- [ ] Product statements do not overstate benefits or hide limitations.

### Usefulness And Korean Writing

- [ ] The introduction begins with the reader's situation rather than generic emotional framing.
- [ ] Recommendations include observable examples, realistic routines, numbers, or decision criteria where useful.
- [ ] Korean speech level and terminology are natural and consistent.
- [ ] Expressions such as `행복`, `소중한`, `막중한 책임`, `아름다운 여정`, and `첫걸음` are not used as filler.
- [ ] Repetition, translated-sounding transitions, and unsupported encouragement are removed.
- [ ] The conclusion is short, does not repeat the introduction, and ends with a useful next action or decision.
- [ ] The summary is materially shorter than the article and matches the edited copy.
- [ ] FAQ answers genuine follow-up questions without repeating the body.

### Review Decision

- [ ] Founder Review scores and feedback are completed when the browser review workflow is used.
- [ ] Automated warnings are resolved or explicitly accepted with a human reason.
- [ ] Editing time is measured, not estimated.
- [ ] The named editor records REVISE, REJECT, or READY_FOR_DRAFT.

## 3. Publish Checklist

- [ ] A named human editor recorded PUBLISH for this exact revision.
- [ ] The WordPress draft matches the approved title, body, summary/excerpt, SEO, FAQ, links, and image.
- [ ] Internal run metadata, prompts, provider details, review notes, and credentials are absent.
- [ ] Publication and update dates are correct.
- [ ] The human editorial owner is displayed.
- [ ] AI-assistance and editorial-review disclosure is accurate and visible according to policy.
- [ ] Privacy, About, Contact, and correction/reporting links are available from the public layout.
- [ ] Internal links point to public canonical URLs and use descriptive anchor text.
- [ ] External sources and required attribution links work.
- [ ] Affiliate or sponsorship disclosure is present before the first applicable commercial link.
- [ ] The article preview is readable on mobile and desktop without overlap, clipping, or broken media.
- [ ] The slug, category, tags, canonical URL, and sharing preview are correct.
- [ ] The article is included in the intended sitemap and RSS behavior.
- [ ] No draft, preview, staging, admin, or local URL is linked publicly.
- [ ] Backup and monitoring prerequisites are READY.
- [ ] The editor manually presses Publish in WordPress; no automated public action is used.

## 4. SEO Checklist

- [ ] The brief names one primary Korean search query and one reader intent.
- [ ] The final title answers that intent without clickbait or unsupported promises.
- [ ] The primary phrase appears naturally in the title and opening, not at a fixed density.
- [ ] H2 headings describe useful subtopics and follow a logical reading order.
- [ ] The SEO title is unique, accurate, and readable without unnecessary brand terms.
- [ ] The meta description states the practical benefit and matches the final article.
- [ ] Keywords are natural phrases a Korean reader would type, not vague categories or AI-generated abstractions.
- [ ] FAQ items represent real follow-up intent.
- [ ] At least one useful foundation or next-step internal link is included when available.
- [ ] The article does not compete unnecessarily with an existing page targeting the same intent.
- [ ] The canonical URL points to the intended public article.
- [ ] Indexing is allowed only for the complete production page.
- [ ] Open Graph title, description, and image match the article.
- [ ] Publication and update dates are accurate.
- [ ] Search-sensitive claims and seasonal details are current.

## 5. Image Checklist

- [ ] The image shows the actual animal, product, environment, or action relevant to the article.
- [ ] Ownership, license, permission, or original-creation evidence is recorded.
- [ ] Commercial use and modification rights are confirmed.
- [ ] Creator, source, acquisition date, license, and required attribution are recorded.
- [ ] Images with missing or ambiguous rights are excluded.
- [ ] The image contains no private data, credentials, addresses, unsafe handling, or misleading condition.
- [ ] Required attribution is visible in the correct location.
- [ ] The filename is descriptive and stable.
- [ ] Alt text describes useful visual information without keyword stuffing.
- [ ] Decorative images use empty alt text where appropriate.
- [ ] Crop and focal point work on mobile, desktop, article cards, and sharing previews.
- [ ] File dimensions and compression preserve readability without unnecessary transfer size.
- [ ] Captions explain context or safety limitations when the image could be misunderstood.
- [ ] The final WordPress image matches the approved asset and rights record.

## 6. Post-Publication Checklist

Complete immediately after publication and repeat critical checks after any material edit.

- [ ] The canonical public URL returns a successful response over HTTPS.
- [ ] The article title, body, summary, FAQ, links, image, disclosure, and owner match the approved draft.
- [ ] Mobile and desktop rendering is readable and free of overlap or broken media.
- [ ] Canonical, robots, title, description, Open Graph, and date metadata are correct.
- [ ] The article appears once in the sitemap and RSS feed where applicable.
- [ ] Internal and external links resolve to the intended destinations.
- [ ] Analytics records a page view without collecting prohibited data.
- [ ] Uptime and error monitoring include the new URL.
- [ ] Search Console inspection or indexing submission is completed according to the launch process.
- [ ] No preview, staging, or internal metadata is exposed.
- [ ] The previous version can be recovered from revision history or backup.
- [ ] Any production correction is made promptly and recorded.
- [ ] The Operation Log entry records the actual publishing decision and editing time.

## 7. Weekly KPI Review

Review the previous seven days at the end of Friday or the next Monday before selecting a new batch. Use actual measured values and mark unavailable data as `Not recorded`.

### Editorial Operations

- Articles generated, retained, revised, rejected, and published.
- PASS, WARNING, and FAIL totals from human review.
- Median and average editing time per published article.
- Major-rewrite rate and the repeated reasons for rewriting.
- Unresolved factual, safety, copyright, disclosure, or publishing issues.

### Acquisition And Engagement

- Organic sessions and impressions by article and search query.
- Search click-through rate for pages with enough impressions to interpret.
- Engaged reading time, completion proxy, return visits, and referral sources.
- New indexed pages, indexing failures, and material ranking changes.
- RSS or email subscriptions when enabled.

### Commercial Signals

- Articles containing affiliate or sponsored content.
- Outbound affiliate clicks, attributable conversions, refunds, and complaints when enabled.
- Disclosure compliance.
- Commercial links that are broken, unavailable, irrelevant, or misleading.

### Weekly Decision

1. Continue the planned cadence only when quality and safety remain stable.
2. Move specific drafts to HOLD or REVISE when evidence is incomplete.
3. Add repeated problems to Improvement Notes in the Operation Log.
4. Do not redesign prompts or product behavior during the KPI meeting; create a separately scoped request when evidence supports it.

## 8. Monthly Improvement Cycle

Run this review once per calendar month using the Operation Log, weekly KPI reviews, Search Console, analytics, corrections, and reader feedback.

### Step 1: Consolidate Evidence

- Summarize articles generated, published, revised, rejected, and held.
- Calculate editing-time distribution, major-rewrite rate, correction rate, and Founder Review trends.
- Group repeated issues by factual accuracy, Korean writing, search intent, FAQ, image rights, WordPress transfer, launch QA, or measurement.
- Separate one-off preferences from problems repeated across at least three relevant articles or two editorial runs.

### Step 2: Evaluate Business Progress

- Compare actual results with the current 30-, 90-, or 180-day Business Plan targets.
- Review acquisition quality, query coverage, return visits, and traffic concentration.
- Review trust indicators including corrections, complaints, disclosure compliance, and safety incidents.
- Review monetization only for explicitly enabled channels.

### Step 3: Prioritize Improvements

Rank candidates by reader or animal-safety risk, frequency, time cost, business impact, confidence, and reversibility.

1. Resolve safety, factual, privacy, copyright, and disclosure risks first.
2. Resolve repeated publishing failures and manual rework second.
3. Improve search usefulness and reader clarity third.
4. Consider growth or monetization changes only after quality controls remain stable.

### Step 4: Approve Scoped Action

- Choose no more than three improvement actions for the next month.
- Define the observed evidence, desired outcome, owner, verification method, and rollback or stop condition.
- Keep documentation or operating changes separate from product, prompt, workflow, and architecture changes.
- Require a new explicit task before any prompt redesign, feature work, workflow change, or architecture change.

### Step 5: Close The Cycle

- Record the monthly decisions and unresolved themes in the next applicable operating record.
- Update checklists or business targets only when evidence justifies the change.
- Recheck the effect of approved actions in the next monthly cycle.
- Preserve rejected ideas with the reason they were not selected so the same debate is not repeated without new evidence.
