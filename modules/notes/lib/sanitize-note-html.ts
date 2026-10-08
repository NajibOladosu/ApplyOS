import DOMPurify from 'dompurify'

/**
 * Sanitizes note HTML before it is rendered with dangerouslySetInnerHTML.
 *
 * Notes are stored as HTML and the API does not sanitize on write, so the
 * renderer is the control point. The allowlist covers the formatting that the
 * note editor produces. Scripts, event-handler attributes, inline styles, and
 * non-http(s)/mailto URLs are removed.
 *
 * Fails closed: if DOMPurify has no DOM to work with, nothing is rendered.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a',
]

const ALLOWED_ATTR = ['href', 'title']

export function sanitizeNoteHtml(html: string | null | undefined): string {
  if (!html) return ''
  if (!DOMPurify.isSupported) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  })
}
