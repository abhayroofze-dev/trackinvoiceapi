// utils/proposalHtml.js
//
// Rich-text (CONTENT sections and Terms) is stored as HTML and later rendered
// with dangerouslySetInnerHTML in the preview. Everything is cleaned here on
// the server so a pasted <script>, onclick=..., or javascript: link can never
// be saved.

// If `npm install` was not run after adding this module, the whole server used to
// crash on start (invoices too). Now it keeps running with a basic built-in cleaner
// and tells you what to do.
let sanitizeHtml = null;
try {
  sanitizeHtml = require('sanitize-html');
} catch (e) {
  console.warn('\u26A0\uFE0F  "sanitize-html" is not installed - run "npm install" in invoice-backend. Using a basic fallback cleaner meanwhile.');
}

function basicClean(html) {
  return String(html)
    .replace(/<\/?(script|style|iframe|object|embed|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi, '$1=$2#');
}

const OPTIONS = {
  allowedTags: [
    'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    '*': ['style'],
  },
  // Only a few harmless inline styles (alignment from the editor, image size).
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      width: [/^\d+(\.\d+)?(px|%)$/],
      height: [/^(auto|\d+(\.\d+)?(px|%))$/],
      'max-width': [/^\d+(\.\d+)?(px|%)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
};

function cleanHtml(html) {
  if (html === undefined || html === null) return '';
  if (!sanitizeHtml) return basicClean(html);
  return sanitizeHtml(String(html), {
    ...OPTIONS,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
  });
}

/** true when the HTML has no visible text and no image */
function isHtmlEmpty(html) {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  const text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0;
}

module.exports = { cleanHtml, isHtmlEmpty };
