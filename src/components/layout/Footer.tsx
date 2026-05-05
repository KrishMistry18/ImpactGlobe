'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-[5] bg-bg-surface/80 backdrop-blur-sm border-t border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          {/* Data Attribution */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
            <span className="font-medium text-text-secondary">Data sources:</span>
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              Open-Meteo
            </a>
            <a
              href="https://openaq.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              OpenAQ
            </a>
            <a
              href="https://earthquake.usgs.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              USGS
            </a>
            <a
              href="https://eonet.gsfc.nasa.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              NASA EONET
            </a>
            <a
              href="https://www.weather.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              NOAA
            </a>
          </div>

          {/* Legal Links */}
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="hover:text-text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-text-primary transition-colors"
            >
              Terms
            </Link>
            <span>© 2026 ImpactGlobe</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
