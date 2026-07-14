const DEFAULT_FORM_STATE = {
  topic: '',
  magazine: 'cat',
  language: 'ko-KR'
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
  let currentResult = null;

  setCopyControls([copyArticleButton, copyMarkdownButton], copyFeedback, false);

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
      result.innerHTML = renderResult(payload);
      currentResult = payload;
      setCopyControls([copyArticleButton, copyMarkdownButton], copyFeedback, true);
    } catch (error) {
      showError(message, error instanceof Error ? error.message : 'Generate request failed.');
      result.className = 'result';
      result.innerHTML = renderError(error instanceof Error ? error.message : 'Generate request failed.');
      currentResult = null;
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
}

export function readFormState(doc) {
  return {
    topic: doc.querySelector('#topic')?.value ?? DEFAULT_FORM_STATE.topic,
    magazine: doc.querySelector('#magazine')?.value ?? DEFAULT_FORM_STATE.magazine,
    language: doc.querySelector('#language')?.value ?? DEFAULT_FORM_STATE.language
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
    language: formState.language || DEFAULT_FORM_STATE.language
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

export function renderResult(result) {
  const packageData = result.publishingPackage ?? {};
  const article = packageData.article ?? {};
  const summary = packageData.summary ?? {};
  const seo = packageData.seo ?? {};
  const metadata = result.contentGenerationMetadata ?? {};
  const review = metadata.editorialReview ?? {};
  const selectedImage = result.selectedImage;
  const instagram = result.previewReport?.channels?.find((channel) => channel.type === 'instagram')?.data;
  const podcast = result.previewReport?.channels?.find((channel) => channel.type === 'podcast')?.data;

  return [
    section('Status', `
      <div class="status-row">
        ${metric('Workflow', result.workflowStatus)}
        ${metric('Quality', metadata.qualityScore ?? 'Unavailable')}
        ${metric('Review', `${metadata.reviewResult ?? review.result ?? 'Unavailable'} / ${metadata.reviewScore ?? review.score ?? 'N/A'}`)}
        ${metric('Approval', metadata.approvalDecision ?? metadata.approvalResult?.decision ?? 'Unavailable')}
      </div>
    `),
    section('Article', `
      <h3>${escapeHtml(article.title ?? 'Untitled')}</h3>
      <p>${escapeHtml(article.summary ?? summary.text ?? 'No summary available.')}</p>
      <pre>${escapeHtml(article.body ?? 'No article body available.')}</pre>
    `),
    section('Summary', `<p>${escapeHtml(summary.text ?? article.summary ?? 'No summary available.')}</p>`),
    section('SEO', `
      <p><strong>Title:</strong> ${escapeHtml(seo.metaTitle ?? 'Unavailable')}</p>
      <p><strong>Description:</strong> ${escapeHtml(seo.metaDescription ?? 'Unavailable')}</p>
    `),
    section('FAQ', renderFaq(packageData.faq)),
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

function section(title, body) {
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span>${escapeHtml(String(value))}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
