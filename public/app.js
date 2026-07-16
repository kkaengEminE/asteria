const DEFAULT_FORM_STATE = {
  topic: '',
  magazine: 'cat',
  language: 'ko-KR',
  provider: 'mock'
};

if (typeof document !== 'undefined') {
  const form = document.querySelector('#generate-form');

  if (form) {
    initAsteriaWebApp(document);
  }
}

export function initAsteriaWebApp(doc, fetchImpl = fetch, clipboardImpl = navigator.clipboard) {
  const form = doc.querySelector('#generate-form');
  const button = doc.querySelector('#generate-button');
  const message = doc.querySelector('#form-message');
  const result = doc.querySelector('#result');
  const copyArticleButton = doc.querySelector('#copy-article-button');
  const copyMarkdownButton = doc.querySelector('#copy-markdown-button');
  const copyFeedback = doc.querySelector('#copy-feedback');
  const historyList = doc.querySelector('#history-list');
  const clearHistoryButton = doc.querySelector('#clear-history-button');
  const compareButton = doc.querySelector('#compare-button');
  const exitCompareButton = doc.querySelector('#exit-compare-button');
  let currentResult = null;
  let historyEntries = [];
  let currentHistoryId = null;
  let selectedHistoryIds = [];
  let compareMode = false;

  setCopyControls([copyArticleButton, copyMarkdownButton], copyFeedback, false);
  renderHistoryPanel({
    historyList,
    clearHistoryButton,
    compareButton,
    exitCompareButton,
    entries: historyEntries,
    currentHistoryId,
    selectedHistoryIds,
    compareMode
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formState = readFormState(doc);
    const validation = validateGenerateForm(formState);

    if (!validation.valid) {
      showError(message, validation.error);
      return;
    }

    currentResult = null;
    setCopyControls([copyArticleButton, copyMarkdownButton], copyFeedback, false);
    setLoading(button, message, result, true);

    try {
      const response = await fetchImpl('/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildGenerateRequest(formState))
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Generate request failed.');
      }

      message.className = 'message';
      message.textContent = 'Generation complete.';
      result.className = 'result';
      currentResult = createWorkingCopy(payload);
      result.innerHTML = renderResult(currentResult);
      compareMode = false;
      const historyEntry = createHistoryEntry(formState, payload, new Date(), currentResult);
      historyEntries = addHistoryEntry(historyEntries, historyEntry);
      currentHistoryId = historyEntry.id;
      renderHistoryPanel({
        historyList,
        clearHistoryButton,
        compareButton,
        exitCompareButton,
        entries: historyEntries,
        currentHistoryId,
        selectedHistoryIds,
        compareMode
      });
      setCopyControls([copyArticleButton, copyMarkdownButton], copyFeedback, true);
    } catch (error) {
      showError(message, error instanceof Error ? error.message : 'Generate request failed.');
      result.className = 'result';
      result.innerHTML = renderError(error instanceof Error ? error.message : 'Generate request failed.');
      currentResult = null;
      currentHistoryId = null;
      compareMode = false;
      renderHistoryPanel({
        historyList,
        clearHistoryButton,
        compareButton,
        exitCompareButton,
        entries: historyEntries,
        currentHistoryId,
        selectedHistoryIds,
        compareMode
      });
      setCopyControls([copyArticleButton, copyMarkdownButton], copyFeedback, false);
    } finally {
      setLoading(button, message, result, false);
    }
  });

  copyArticleButton?.addEventListener('click', async () => {
    await copyGeneratedText(
      buildArticleCopyText(currentResult),
      clipboardImpl,
      copyFeedback
    );
  });

  copyMarkdownButton?.addEventListener('click', async () => {
    await copyGeneratedText(
      buildMarkdownCopyText(currentResult),
      clipboardImpl,
      copyFeedback
    );
  });

  result?.addEventListener('input', (event) => {
    const editorField = event.target?.closest?.('[data-edit-field]');

    if (!editorField || !currentResult || compareMode) {
      return;
    }

    updateWorkingCopy(
      currentResult,
      editorField.dataset.editField,
      editorField.value,
      Number(editorField.dataset.faqIndex)
    );
  });

  historyList?.addEventListener('click', (event) => {
    const compareCheckbox = event.target?.closest?.('[data-compare-id]');

    if (compareCheckbox) {
      selectedHistoryIds = toggleCompareSelection(
        selectedHistoryIds,
        compareCheckbox.dataset.compareId,
        compareCheckbox.checked
      );
      renderHistoryPanel({
        historyList,
        clearHistoryButton,
        compareButton,
        exitCompareButton,
        entries: historyEntries,
        currentHistoryId,
        selectedHistoryIds,
        compareMode
      });
      return;
    }

    const historyButton = event.target?.closest?.('[data-history-id]');

    if (!historyButton) {
      return;
    }

    const entry = restoreHistoryEntry(historyEntries, historyButton.dataset.historyId);

    if (!entry) {
      return;
    }

    currentResult = entry.workingCopy ?? createWorkingCopy(entry.result);
    entry.workingCopy = currentResult;
    currentHistoryId = entry.id;
    compareMode = false;
    restoreFormState(doc, entry);
    message.className = 'message';
    message.textContent = 'History result restored.';
    result.className = 'result';
    result.innerHTML = renderResult(currentResult);
    setCopyControls([copyArticleButton, copyMarkdownButton], copyFeedback, true);
    renderHistoryPanel({
      historyList,
      clearHistoryButton,
      compareButton,
      exitCompareButton,
      entries: historyEntries,
      currentHistoryId,
      selectedHistoryIds,
      compareMode
    });
  });

  clearHistoryButton?.addEventListener('click', () => {
    historyEntries = clearHistoryEntries();
    currentHistoryId = null;
    selectedHistoryIds = [];
    compareMode = false;
    renderHistoryPanel({
      historyList,
      clearHistoryButton,
      compareButton,
      exitCompareButton,
      entries: historyEntries,
      currentHistoryId,
      selectedHistoryIds,
      compareMode
    });
    renderCurrentResult(result, currentResult);
  });

  compareButton?.addEventListener('click', () => {
    const selectedEntries = getSelectedHistoryEntries(historyEntries, selectedHistoryIds);

    if (!canCompare(selectedHistoryIds)) {
      return;
    }

    compareMode = true;
    message.className = 'message';
    message.textContent = 'Compare mode active.';
    result.className = 'result';
    result.innerHTML = renderCompareView(selectedEntries);
    renderHistoryPanel({
      historyList,
      clearHistoryButton,
      compareButton,
      exitCompareButton,
      entries: historyEntries,
      currentHistoryId,
      selectedHistoryIds,
      compareMode
    });
  });

  exitCompareButton?.addEventListener('click', () => {
    compareMode = false;
    message.className = 'message';
    message.textContent = currentResult ? 'Viewer restored.' : '';
    renderCurrentResult(result, currentResult);
    renderHistoryPanel({
      historyList,
      clearHistoryButton,
      compareButton,
      exitCompareButton,
      entries: historyEntries,
      currentHistoryId,
      selectedHistoryIds,
      compareMode
    });
  });
}

export function readFormState(doc) {
  return {
    topic: doc.querySelector('#topic')?.value ?? DEFAULT_FORM_STATE.topic,
    magazine: doc.querySelector('#magazine')?.value ?? DEFAULT_FORM_STATE.magazine,
    language: doc.querySelector('#language')?.value ?? DEFAULT_FORM_STATE.language,
    provider: doc.querySelector('#provider')?.value ?? DEFAULT_FORM_STATE.provider
  };
}

export function validateGenerateForm(formState) {
  if (!formState.topic || formState.topic.trim().length === 0) {
    return {
      valid: false,
      error: 'Topic is required.'
    };
  }

  return {
    valid: true
  };
}

export function buildGenerateRequest(formState) {
  return {
    topic: formState.topic.trim(),
    magazine: formState.magazine || DEFAULT_FORM_STATE.magazine,
    language: formState.language || DEFAULT_FORM_STATE.language,
    provider: formState.provider || DEFAULT_FORM_STATE.provider
  };
}

export function getGenerateButtonState(isLoading) {
  return {
    disabled: isLoading,
    label: isLoading ? 'Generating...' : 'Generate'
  };
}

export function getCopyButtonState(hasResult) {
  return {
    disabled: !hasResult
  };
}

export function getCopyFeedbackState(success) {
  return {
    className: success ? 'copy-feedback' : 'copy-feedback error',
    text: success ? 'Copied' : 'Copy failed'
  };
}

export function buildArticleCopyText(result) {
  const article = result?.publishingPackage?.article ?? {};
  const title = article.title ?? 'Untitled';
  const body = article.body ?? '';

  return `${title}\n\n${body}`.trim();
}

export function buildMarkdownCopyText(result) {
  const packageData = result?.publishingPackage ?? {};
  const article = packageData.article ?? {};
  const summary = packageData.summary ?? {};
  const seo = packageData.seo ?? {};
  const faq = Array.isArray(packageData.faq) ? packageData.faq : [];
  const title = article.title ?? 'Untitled';
  const summaryText = summary.text ?? article.summary ?? '';
  const body = article.body ?? '';
  const seoTitle = seo.metaTitle ?? '';
  const seoDescription = seo.metaDescription ?? '';
  const faqText = faq.length > 0
    ? faq.map((item) => `### ${item.question ?? ''}\n\n${item.answer ?? ''}`.trim()).join('\n\n')
    : 'No FAQ available.';

  return [
    `# ${title}`,
    '## Summary',
    summaryText,
    '## Article',
    body,
    '## SEO',
    `Title: ${seoTitle}`,
    `Description: ${seoDescription}`,
    '## FAQ',
    faqText
  ].join('\n\n').trim();
}

export function createWorkingCopy(result) {
  if (typeof structuredClone === 'function') {
    return structuredClone(result);
  }

  return JSON.parse(JSON.stringify(result));
}

export function updateWorkingCopy(workingCopy, field, value, faqIndex = Number.NaN) {
  const packageData = workingCopy?.publishingPackage;

  if (!packageData) {
    return workingCopy;
  }

  const fieldPaths = {
    title: ['article', 'title'],
    body: ['article', 'body'],
    summary: ['summary', 'text'],
    seoTitle: ['seo', 'metaTitle'],
    seoDescription: ['seo', 'metaDescription']
  };
  const path = fieldPaths[field];

  if (path) {
    packageData[path[0]] ??= {};
    packageData[path[0]][path[1]] = value;
    return workingCopy;
  }

  if ((field === 'faqQuestion' || field === 'faqAnswer') && Number.isInteger(faqIndex)) {
    const faqItem = packageData.faq?.[faqIndex];

    if (faqItem) {
      faqItem[field === 'faqQuestion' ? 'question' : 'answer'] = value;
    }
  }

  return workingCopy;
}

export function createHistoryEntry(formState, result, generatedAt = new Date(), workingCopy = createWorkingCopy(result)) {
  const request = buildGenerateRequest(formState);

  return {
    id: `${Date.parse(generatedAt.toISOString())}-${Math.random().toString(36).slice(2)}`,
    topic: request.topic,
    magazine: request.magazine,
    language: request.language,
    provider: request.provider,
    generatedAt: generatedAt.toISOString(),
    result,
    workingCopy
  };
}

export function addHistoryEntry(entries, entry) {
  return [entry, ...entries];
}

export function restoreHistoryEntry(entries, id) {
  return entries.find((entry) => entry.id === id) ?? null;
}

export function clearHistoryEntries() {
  return [];
}

export function renderHistoryEntries(entries, currentHistoryId, now = new Date()) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<p class="history-empty">No generated results yet.</p>';
  }

  return entries.map((entry) => {
    const isCurrent = entry.id === currentHistoryId;
    const className = isCurrent ? 'history-item current' : 'history-item';

    return `
      <div class="${className}" aria-current="${isCurrent ? 'true' : 'false'}">
        <input type="checkbox" data-compare-id="${escapeHtml(entry.id)}" aria-label="Select ${escapeHtml(entry.topic)} for comparison">
        <button class="history-restore" type="button" data-history-id="${escapeHtml(entry.id)}">
          <span class="history-topic">${escapeHtml(entry.topic)}</span>
          <span class="history-meta">${escapeHtml(entry.provider)} · ${escapeHtml(entry.magazine)} · ${escapeHtml(entry.language)} · ${escapeHtml(formatRelativeTimestamp(entry.generatedAt, now))}</span>
        </button>
      </div>
    `;
  }).join('');
}

export function toggleCompareSelection(selectedIds, id, selected, maxSelected = 3) {
  if (!id) {
    return selectedIds;
  }

  if (!selected) {
    return selectedIds.filter((selectedId) => selectedId !== id);
  }

  if (selectedIds.includes(id)) {
    return selectedIds;
  }

  if (selectedIds.length >= maxSelected) {
    return selectedIds;
  }

  return [...selectedIds, id];
}

export function canCompare(selectedIds) {
  return selectedIds.length >= 2 && selectedIds.length <= 3;
}

export function getSelectedHistoryEntries(entries, selectedIds) {
  return selectedIds
    .map((id) => entries.find((entry) => entry.id === id))
    .filter(Boolean);
}

export function renderCompareView(entries) {
  const fields = buildCompareFields(entries);
  const differingKeys = findDifferingCompareFields(fields, [
    'provider',
    'title',
    'summary',
    'qualityScore',
    'approval'
  ]);

  return section('Compare', `
    <div class="compare-grid">
      ${entries.map((entry) => renderCompareColumn(entry, fields, differingKeys)).join('')}
    </div>
  `);
}

export function buildCompareFields(entries) {
  return entries.map((entry) => {
    const result = entry.workingCopy ?? entry.result ?? {};
    const packageData = result.publishingPackage ?? {};
    const article = packageData.article ?? {};
    const summary = packageData.summary ?? {};
    const seo = packageData.seo ?? {};
    const metadata = result.contentGenerationMetadata ?? {};
    const instagram = result.previewReport?.channels?.find((channel) => channel.type === 'instagram')?.data;
    const podcast = result.previewReport?.channels?.find((channel) => channel.type === 'podcast')?.data;

    return {
      id: entry.id,
      provider: entry.provider,
      topic: entry.topic,
      magazine: entry.magazine,
      language: entry.language,
      generatedAt: entry.generatedAt,
      title: article.title ?? 'Untitled',
      summary: summary.text ?? article.summary ?? 'No summary available.',
      body: article.body ?? 'No article body available.',
      seoTitle: seo.metaTitle ?? 'Unavailable',
      seoDescription: seo.metaDescription ?? 'Unavailable',
      faq: renderCompareFaq(packageData.faq),
      qualityScore: metadata.qualityScore ?? 'Unavailable',
      editorialScore: metadata.reviewScore ?? metadata.editorialReview?.score ?? 'Unavailable',
      approval: metadata.approvalDecision ?? metadata.approvalResult?.decision ?? 'Unavailable',
      instagram: instagram
        ? `${instagram.shortCaption ?? ''}${instagram.cta ? `\nCTA: ${instagram.cta}` : ''}`.trim()
        : 'Unavailable',
      podcast: podcast
        ? `${podcast.episodeTitle ?? ''}${podcast.estimatedDuration ? `\nDuration: ${podcast.estimatedDuration}` : ''}`.trim()
        : 'Unavailable'
    };
  });
}

export function findDifferingCompareFields(fieldRows, keys) {
  return new Set(keys.filter((key) => {
    const values = fieldRows.map((row) => String(row[key] ?? ''));
    return new Set(values).size > 1;
  }));
}

export function formatRelativeTimestamp(generatedAt, now = new Date()) {
  const generatedTime = Date.parse(generatedAt);
  const nowTime = Date.parse(now.toISOString());

  if (!Number.isFinite(generatedTime) || !Number.isFinite(nowTime)) {
    return 'just now';
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowTime - generatedTime) / 1000));

  if (elapsedSeconds < 60) {
    return 'just now';
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  return `${Math.floor(elapsedHours / 24)}d ago`;
}

export function renderResult(result) {
  const packageData = result.publishingPackage ?? {};
  const article = packageData.article ?? {};
  const summary = packageData.summary ?? {};
  const seo = packageData.seo ?? {};
  const metadata = result.contentGenerationMetadata ?? {};
  const review = metadata.editorialReview ?? {};
  const providerName = getProviderName(result);
  const elapsed = getElapsedGenerationTime(result);
  const selectedImage = result.selectedImage;
  const instagram = result.previewReport?.channels?.find((channel) => channel.type === 'instagram')?.data;
  const podcast = result.previewReport?.channels?.find((channel) => channel.type === 'podcast')?.data;

  return [
    section('Status', `
      <div class="status-row">
        ${metric('Workflow', result.workflowStatus)}
        ${metric('Provider', providerName)}
        ${metric('Elapsed', elapsed)}
        ${metric('Quality', metadata.qualityScore ?? 'Unavailable')}
        ${metric('Review', `${metadata.reviewResult ?? review.result ?? 'Unavailable'} / ${metadata.reviewScore ?? review.score ?? 'N/A'}`)}
        ${metric('Approval', metadata.approvalDecision ?? metadata.approvalResult?.decision ?? 'Unavailable')}
      </div>
    `),
    result.workflowStatus === 'failed' && result.error
      ? section('Error', `<p>${escapeHtml(result.error)}</p>`)
      : '',
    section('Article', `
      ${editorField('Title', 'title', article.title ?? '')}
      ${editorField('Body', 'body', article.body ?? '', 'editor-textarea editor-body')}
    `, 'editor-section'),
    section('Summary', editorField('Summary', 'summary', summary.text ?? article.summary ?? '', 'editor-textarea'), 'editor-section'),
    section('SEO', `
      ${editorField('SEO title', 'seoTitle', seo.metaTitle ?? '')}
      ${editorField('SEO description', 'seoDescription', seo.metaDescription ?? '', 'editor-textarea')}
    `, 'editor-section'),
    section('FAQ', renderEditableFaq(packageData.faq), 'editor-section'),
    section('Selected Image', selectedImage
      ? `
        <p><strong>Filename:</strong> ${escapeHtml(selectedImage.filename)}</p>
        <p><strong>Category:</strong> ${escapeHtml(selectedImage.category ?? 'Unavailable')}</p>
        <p><strong>Tags:</strong> ${escapeHtml((selectedImage.tags ?? []).join(', '))}</p>
      `
      : '<p>No image selected.</p>'),
    section('Monetization', `<pre>${escapeHtml(result.monetizationPreview ?? 'No monetization preview available.')}</pre>`),
    instagram ? section('Instagram', `
      <p><strong>Short caption:</strong> ${escapeHtml(instagram.shortCaption ?? '')}</p>
      <p><strong>CTA:</strong> ${escapeHtml(instagram.cta ?? '')}</p>
    `) : '',
    podcast ? section('Podcast', `
      <p><strong>Episode:</strong> ${escapeHtml(podcast.episodeTitle ?? '')}</p>
      <p><strong>Estimated duration:</strong> ${escapeHtml(podcast.estimatedDuration ?? '')}</p>
    `) : '',
    `<details><summary>Raw JSON</summary><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre></details>`
  ].filter(Boolean).join('');
}

export function renderError(message) {
  return section('Error', `<p>${escapeHtml(message)}</p>`);
}

function setLoading(button, message, result, isLoading) {
  const state = getGenerateButtonState(isLoading);

  button.disabled = state.disabled;
  button.textContent = state.label;

  if (isLoading) {
    message.className = 'message';
    message.textContent = 'Generating preview package...';
    result.className = 'result';
    result.innerHTML = section('Generating', '<p>Preparing article, SEO, review, image, monetization, and channel previews.</p>');
  }
}

function setCopyControls(buttons, feedback, hasResult) {
  const state = getCopyButtonState(hasResult);

  for (const copyButton of buttons) {
    if (copyButton) {
      copyButton.disabled = state.disabled;
    }
  }

  if (feedback) {
    feedback.className = 'copy-feedback';
    feedback.textContent = '';
  }
}

async function copyGeneratedText(text, clipboard, feedback) {
  try {
    if (!text || !clipboard?.writeText) {
      throw new Error('Clipboard unavailable.');
    }

    await clipboard.writeText(text);
    setCopyFeedback(feedback, true);
  } catch {
    setCopyFeedback(feedback, false);
  }
}

function setCopyFeedback(feedback, success) {
  if (!feedback) {
    return;
  }

  const state = getCopyFeedbackState(success);
  feedback.className = state.className;
  feedback.textContent = state.text;
}

function renderHistoryPanel({
  historyList,
  clearHistoryButton,
  compareButton,
  exitCompareButton,
  entries,
  currentHistoryId,
  selectedHistoryIds,
  compareMode
}) {
  if (historyList) {
    historyList.innerHTML = renderHistoryEntries(entries, currentHistoryId);

    for (const checkbox of historyList.querySelectorAll('[data-compare-id]')) {
      checkbox.checked = selectedHistoryIds.includes(checkbox.dataset.compareId);
      checkbox.disabled = !checkbox.checked && selectedHistoryIds.length >= 3;
    }
  }

  if (clearHistoryButton) {
    clearHistoryButton.disabled = entries.length === 0;
  }

  if (compareButton) {
    compareButton.disabled = !canCompare(selectedHistoryIds);
  }

  if (exitCompareButton) {
    exitCompareButton.hidden = !compareMode;
  }
}

function renderCurrentResult(resultElement, currentResult) {
  if (!resultElement) {
    return;
  }

  if (currentResult) {
    resultElement.className = 'result';
    resultElement.innerHTML = renderResult(currentResult);
    return;
  }

  resultElement.className = 'result empty';
  resultElement.innerHTML = `
    <div class="empty-state">
      <h2>Ready</h2>
      <p>Enter a topic, choose a magazine and language, then generate a preview package.</p>
    </div>
  `;
}

function restoreFormState(doc, entry) {
  setControlValue(doc.querySelector('#topic'), entry.topic);
  setControlValue(doc.querySelector('#magazine'), entry.magazine);
  setControlValue(doc.querySelector('#language'), entry.language);
  setControlValue(doc.querySelector('#provider'), entry.provider);
}

function setControlValue(control, value) {
  if (control) {
    control.value = value;
  }
}

function showError(message, text) {
  message.className = 'message error';
  message.textContent = text;
}

function renderFaq(faq = []) {
  if (!Array.isArray(faq) || faq.length === 0) {
    return '<p>No FAQ available.</p>';
  }

  return `<ul>${faq.map((item) => `
    <li><strong>${escapeHtml(item.question ?? '')}</strong><br>${escapeHtml(item.answer ?? '')}</li>
  `).join('')}</ul>`;
}

function editorField(label, field, value, className = 'editor-input') {
  const isTextarea = className.includes('textarea');
  const attributes = `class="${className}" data-edit-field="${field}" aria-label="${escapeHtml(label)}"`;

  return `
    <label class="editor-field">
      <span>${escapeHtml(label)}</span>
      ${isTextarea
        ? `<textarea ${attributes}>${escapeHtml(value)}</textarea>`
        : `<input ${attributes} type="text" value="${escapeHtml(value)}">`}
    </label>
  `;
}

function renderEditableFaq(faq = []) {
  if (!Array.isArray(faq) || faq.length === 0) {
    return '<p>No FAQ available.</p>';
  }

  return `<div class="faq-editor">${faq.map((item, index) => `
    <fieldset class="faq-item">
      <legend>FAQ ${index + 1}</legend>
      <label class="editor-field">
        <span>Question</span>
        <input class="editor-input" type="text" data-edit-field="faqQuestion" data-faq-index="${index}" aria-label="FAQ ${index + 1} question" value="${escapeHtml(item.question ?? '')}">
      </label>
      <label class="editor-field">
        <span>Answer</span>
        <textarea class="editor-textarea" data-edit-field="faqAnswer" data-faq-index="${index}" aria-label="FAQ ${index + 1} answer">${escapeHtml(item.answer ?? '')}</textarea>
      </label>
    </fieldset>
  `).join('')}</div>`;
}

function renderCompareColumn(entry, fieldRows, differingKeys) {
  const fields = fieldRows.find((row) => row.id === entry.id);

  return `
    <article class="compare-column">
      <h3>${escapeHtml(fields.title)}</h3>
      ${compareField('Provider', fields.provider, differingKeys.has('provider'))}
      ${compareField('Topic', fields.topic)}
      ${compareField('Magazine', fields.magazine)}
      ${compareField('Language', fields.language)}
      ${compareField('Generation timestamp', fields.generatedAt)}
      ${compareField('Article title', fields.title, differingKeys.has('title'))}
      ${compareField('Summary', fields.summary, differingKeys.has('summary'))}
      ${compareField('Article body', fields.body)}
      ${compareField('SEO title', fields.seoTitle)}
      ${compareField('SEO description', fields.seoDescription)}
      ${compareField('FAQ', fields.faq)}
      ${compareField('Quality score', fields.qualityScore, differingKeys.has('qualityScore'))}
      ${compareField('Editorial score', fields.editorialScore)}
      ${compareField('Approval decision', fields.approval, differingKeys.has('approval'))}
      ${compareField('Instagram preview', fields.instagram)}
      ${compareField('Podcast preview', fields.podcast)}
    </article>
  `;
}

function compareField(label, value, different = false) {
  return `
    <div class="compare-field ${different ? 'compare-different' : ''}">
      <span class="compare-label">${escapeHtml(label)}</span>
      <div class="compare-value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function renderCompareFaq(faq = []) {
  if (!Array.isArray(faq) || faq.length === 0) {
    return 'No FAQ available.';
  }

  return faq.map((item) => `${item.question ?? ''}\n${item.answer ?? ''}`.trim()).join('\n\n');
}

function section(title, body, className = '') {
  return `<section class="section${className ? ` ${className}` : ''}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span>${escapeHtml(String(value))}</div>`;
}

function getProviderName(result) {
  return result.contentGenerationMetadata?.providerName
    ?? result.publishingPackage?.metadata?.provider
    ?? result.publishingPackage?.metadata?.providerName
    ?? 'Unavailable';
}

function getElapsedGenerationTime(result) {
  const duration = result.contentGenerationMetadata?.durationMs
    ?? result.contentGenerationMetadata?.generationDurationMs
    ?? result.generationDurationMs;

  if (typeof duration === 'number') {
    return `${duration}ms`;
  }

  return 'Unavailable';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
