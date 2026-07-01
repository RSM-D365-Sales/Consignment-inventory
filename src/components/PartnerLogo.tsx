import { useEffect, useMemo, useState } from 'react'
import type { Customer } from '../models/types'

/**
 * Ordered list of logo image URLs to attempt for a partner.
 * 1. an explicit logoUrl, if set
 * 2. a proper brand logo by domain (Clearbit logo API)
 * 3. the brand's icon by domain (Google favicon service — very reliable)
 * If all fail, the component falls back to a colored monogram.
 *
 * NOTE: logos are fetched at runtime by the browser from third-party services
 * for illustration in this demo — no logo files are bundled or stored.
 */
function logoCandidates(c: Customer): string[] {
  const urls: string[] = []
  if (c.logoUrl) urls.push(c.logoUrl)
  if (c.domain) {
    urls.push(`https://logo.clearbit.com/${c.domain}`)
    urls.push(`https://www.google.com/s2/favicons?domain=${c.domain}&sz=128`)
  }
  return urls
}

interface Props {
  customer: Customer
  /** Square size in px. */
  size?: number
  /** Corner radius in px. */
  rounded?: number
  className?: string
}

export function PartnerLogo({
  customer,
  size = 52,
  rounded = 6,
  className = '',
}: Props) {
  const candidates = useMemo(() => logoCandidates(customer), [customer])
  const [idx, setIdx] = useState(0)

  // Restart the candidate chain whenever the partner changes.
  useEffect(() => setIdx(0), [customer.id])

  const exhausted = idx >= candidates.length

  if (exhausted) {
    return (
      <span
        className={`partner-logo partner-logo--mono ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          background: customer.accent,
          fontSize: Math.max(10, size * 0.26),
        }}
        aria-label={customer.name}
      >
        {customer.code}
      </span>
    )
  }

  return (
    <span
      className={`partner-logo ${className}`}
      style={{ width: size, height: size, borderRadius: rounded }}
      title={customer.name}
    >
      <img
        src={candidates[idx]}
        alt={`${customer.name} logo`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
      />
    </span>
  )
}
