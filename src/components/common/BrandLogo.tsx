import React from 'react'

export type BrandLogoVariant = 'sidebar' | 'sidebar-collapsed' | 'login'

interface BrandLogoProps {
  variant: BrandLogoVariant
}

// vite.config.ts sets base: '/erp/', so a hardcoded '/brand/...' src 404s —
// the app is actually served under /erp/, meaning the real path is
// /erp/brand/.... BASE_URL always reflects the configured base (with a
// trailing slash), so prefixing with it keeps this correct under any base.
const BRAND_BASE = `${import.meta.env.BASE_URL}brand/`

const logFailedLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
  console.error('[BrandLogo] failed to load', (e.target as HTMLImageElement).src)
}

// logo-block.png = GENIUS block mark only (transparent, no wordmark) — safe
// on the navy sidebar (#0f2d5e). logo-full.png includes the blue
// "ENGINEERING" text, which is invisible against navy, so it's login-only
// (white card background). Never swap these two between variants.
const BrandLogo: React.FC<BrandLogoProps> = ({ variant }) => {
  if (variant === 'sidebar') {
    // logo-block.png has no wordmark baked in, so "ENGINEERING" is rendered
    // as real text under it (never logo-full.png here — its blue
    // "ENGINEERING" text is invisible on the navy sidebar at this size).
    // The column is a single flex item within AppLayout's logoBlock() row,
    // so that row's existing alignItems: 'center' centers this whole
    // block+text group against the "ERP System" text — no parent change
    // needed. alignSelf: 'flex-start' on the image stops flexbox from
    // stretching/distorting it if the letter-spaced text below ends up
    // wider than the image's natural width.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <img
          src={`${BRAND_BASE}logo-block.png`}
          alt="Genius Engineering"
          onError={logFailedLoad}
          style={{ height: 30, width: 'auto', borderRadius: 6, objectFit: 'contain', display: 'block', alignSelf: 'flex-start' }}
        />
        <div style={{
          marginTop: 3,
          fontFamily: 'Sarabun',
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: '0.35em',
          lineHeight: 1,
          color: '#bfdbfe',
          whiteSpace: 'nowrap',
        }}>
          ENGINEERING
        </div>
      </div>
    )
  }

  if (variant === 'sidebar-collapsed') {
    return (
      <img
        src={`${BRAND_BASE}icon-192.png`}
        alt="Genius Engineering"
        onError={logFailedLoad}
        style={{ height: 38, width: 38, borderRadius: 10, flexShrink: 0, objectFit: 'contain' }}
      />
    )
  }

  // login
  return (
    <img
      src={`${BRAND_BASE}logo-full.png`}
      alt="Genius Engineering"
      onError={logFailedLoad}
      style={{ display: 'block', margin: '0 auto', width: '100%', maxWidth: 220, height: 'auto' }}
    />
  )
}

export default BrandLogo
