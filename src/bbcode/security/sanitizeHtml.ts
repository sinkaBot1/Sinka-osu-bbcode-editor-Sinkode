import DOMPurify from 'dompurify'

const allowedTags = [
  'a',
  'audio',
  'blockquote',
  'br',
  'button',
  'code',
  'del',
  'div',
  'em',
  'h2',
  'h4',
  'iframe',
  'img',
  'li',
  'p',
  'pre',
  'span',
  'strong',
  'u',
  'ul',
  'ol',
]

const allowedAttributes = [
  'alt',
  'aria-expanded',
  'class',
  'controls',
  'height',
  'hidden',
  'href',
  'id',
  'loading',
  'name',
  'rel',
  'src',
  'style',
  'target',
  'title',
  'type',
  'width',
]

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: false,
  })
}
