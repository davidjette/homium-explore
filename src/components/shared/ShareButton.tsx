import { useState } from 'react'
import { Button } from '../../design-system/Button'
import type { FundConfig } from '../../lib/types'

interface Props {
  fund: FundConfig
  programName: string
}

/** Encode fund config into a shareable URL */
function buildShareUrl(fund: FundConfig): string {
  // Strip payoffSchedule (server uses default) and timestamps to minimize URL size
  const { payoffSchedule, createdAt, updatedAt, id, ...slim } = fund as any
  const json = JSON.stringify(slim)
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${window.location.origin}/program#c=${b64}`
}

export default function ShareButton({ fund, programName }: Props) {
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const shareUrl = buildShareUrl(fund)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for insecure contexts
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
    setShowMenu(false)
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(`${programName} — Pro Forma Model`)
    const body = encodeURIComponent(
      `Take a look at this Homium program model:\n\n${programName}\n\n${shareUrl}\n\nYou can view the live model, export to Excel, or download a PDF.`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self')
    setShowMenu(false)
  }

  return (
    <div className="relative inline-block">
      <Button variant="outline" onClick={() => setShowMenu(!showMenu)}>
        {copied ? 'Link Copied!' : 'Share This Program'}
        {!copied && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        )}
      </Button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-white rounded-lg shadow-lg border border-border/50 py-1 min-w-[180px]">
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2.5 text-left text-sm text-dark hover:bg-cream transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copy Link
            </button>
            <button
              onClick={handleEmail}
              className="w-full px-4 py-2.5 text-left text-sm text-dark hover:bg-cream transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              Send via Email
            </button>
          </div>
        </>
      )}
    </div>
  )
}
