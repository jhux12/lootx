const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) {
    return trimmed;
  }
  return '#';
};

const applyEmphasis = (value: string) =>
  value
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

const renderInlineMarkdown = (value: string) => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let result = '';
  let lastIndex = 0;
  let match = linkRegex.exec(value);

  while (match) {
    const [fullMatch, label, url] = match;
    const before = value.slice(lastIndex, match.index);
    result += applyEmphasis(escapeHtml(before));
    const safeLabel = applyEmphasis(escapeHtml(label));
    const safeUrl = escapeHtml(sanitizeUrl(url));
    result += `<a class="text-purple-300 underline underline-offset-4 hover:text-purple-200" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
    lastIndex = match.index + fullMatch.length;
    match = linkRegex.exec(value);
  }

  result += applyEmphasis(escapeHtml(value.slice(lastIndex)));
  return result;
};

export const renderMarkdownToHtml = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let isListOpen = false;

  const closeList = () => {
    if (isListOpen) {
      html.push('</ul>');
      isListOpen = false;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      html.push('<div class="h-3"></div>');
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = renderInlineMarkdown(headingMatch[2]);
      const headingClass =
        level === 1
          ? 'text-2xl md:text-3xl font-semibold text-white mt-6 first:mt-0'
          : level === 2
            ? 'text-xl md:text-2xl font-semibold text-white mt-5 first:mt-0'
            : 'text-lg md:text-xl font-semibold text-white mt-4 first:mt-0';
      html.push(`<h${level} class="${headingClass}">${text}</h${level}>`);
      return;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (!isListOpen) {
        html.push('<ul class="ml-5 list-disc space-y-1 text-sm md:text-base text-gray-200">');
        isListOpen = true;
      }
      html.push(`<li>${renderInlineMarkdown(listMatch[1])}</li>`);
      return;
    }

    closeList();
    html.push(
      `<p class="text-sm md:text-base text-gray-200 leading-relaxed">${renderInlineMarkdown(trimmed)}</p>`
    );
  });

  closeList();
  return html.join('');
};
