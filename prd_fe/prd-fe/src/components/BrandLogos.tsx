// Real brand marks (inline SVG) + the StoryMapper product logo.

export function StoryMapperLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="smlg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B74EE" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#smlg)" />
      <rect x="6" y="6.5" width="5.6" height="7" rx="1.8" fill="#fff" opacity="0.95" />
      <rect x="13.2" y="6.5" width="5.6" height="11" rx="1.8" fill="#fff" opacity="0.72" />
      <rect x="20.4" y="6.5" width="5.6" height="15" rx="1.8" fill="#fff" opacity="0.95" />
      <rect x="6" y="15.5" width="5.6" height="6" rx="1.8" fill="#fff" opacity="0.5" />
      <rect x="13.2" y="19.5" width="5.6" height="6" rx="1.8" fill="#fff" opacity="0.4" />
    </svg>
  )
}

export function JiraLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#2684FF"
        d="M23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"
      />
      <path
        fill="#2684FF"
        opacity="0.8"
        d="M17.294 5.756H5.736a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.002Z"
      />
      <path
        fill="#2684FF"
        opacity="0.55"
        d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005Z"
      />
    </svg>
  )
}

export function AzureDevOpsLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0078D4"
        d="M0 8.877 2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707Zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415Z"
      />
    </svg>
  )
}

export function MondayLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="0.5" y="9.2" width="14.5" height="5.4" rx="2.7" fill="#FF3D57" transform="rotate(-34 7.75 11.9)" />
      <rect x="7.5" y="12.6" width="12.5" height="5.4" rx="2.7" fill="#FFCB00" transform="rotate(-34 13.75 15.3)" />
      <circle cx="21" cy="15.5" r="2.9" fill="#00CA72" />
    </svg>
  )
}

export function MarkdownLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round((size * 128) / 208)} viewBox="0 0 208 128" aria-hidden="true">
      <rect
        x="5"
        y="5"
        width="198"
        height="118"
        rx="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
      />
      <path
        fill="currentColor"
        d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39Zm125 0-30-33h20V30h20v35h20Z"
      />
    </svg>
  )
}
