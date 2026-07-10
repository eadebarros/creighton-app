/** Design tokens — ported verbatim from design/README.md. Do not hardcode hex/px in components. */

export const colors = {
  // Clinical tokens — only usable inside <StampBadge> (exception: Dashboard do Homem circle, Sprint 3).
  red: '#E02424',
  green: '#16A34A',
  white: '#FFFFFF',
  yellow: '#EAB308',

  // Support palette.
  paper: '#F7F4EE',
  ink: '#2B2A28',
  inkMuted: '#6B6862',
  paperDark: '#1C1B19',
  accent: '#3B4C63',
  line: '#D8D3C7',
} as const;

export const fonts = {
  display: {
    medium: 'Fraunces_500Medium',
    semiBold: 'Fraunces_600SemiBold',
  },
  body: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
  },
  mono: {
    medium: 'IBMPlexMono_500Medium',
    semiBold: 'IBMPlexMono_600SemiBold',
  },
} as const;

/** Base 4px spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  stamp: 4,
} as const;

export const shadows = {
  card: {
    shadowColor: 'rgba(43,42,40,0.08)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
} as const;

/** Minimum tap target for any option in the capture flow. */
export const minTouchTarget = 48;
