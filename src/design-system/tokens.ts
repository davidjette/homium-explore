/** DGA Design Tokens — extracted from https://vw04.github.io/dga-affordability-gap/ */

export const colors = {
  green:      '#3D7A58',
  greenDark:  '#2E5E43',
  greenLight: '#f0f7f4',
  dark:       '#1A2930',
  gray:       '#555555',
  lightGray:  '#888888',
  border:     '#E5E5E0',
  sectionAlt: '#F7F7F4',
  bg:         '#FFFFFF',
  mapFill:    'rgba(61,122,88,0.04)',
  mapStroke:  'rgba(61,122,88,0.4)',
  overlay:    'rgba(255,255,255,0.72)',
} as const;

export const fonts = {
  heading: '"Taviraj", serif',
  body:    '"Ubuntu", sans-serif',
} as const;

export const fontWeights = {
  light:    300,
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
} as const;

export const fontSizes = {
  xs:      '11px',
  sm:      '12px',
  base:    '16px',
  lg:      '19px',
  xl:      '24px',
  '2xl':   '26px',
  '3xl':   '32px',
  '4xl':   '38px',
  '5xl':   '44px',
  '6xl':   '50px',
} as const;

export const spacing = {
  xs:  '8px',
  sm:  '14px',
  md:  '20px',
  lg:  '28px',
  xl:  '40px',
  '2xl': '56px',
  '3xl': '88px',
  '4xl': '100px',
} as const;

export const radii = {
  sm:  '4px',
  md:  '6px',
  lg:  '8px',
} as const;

export const transitions = {
  fast:    '0.2s ease',
  medium:  '0.3s ease',
  slow:    '0.4s ease',
  map:     '0.5s ease',
} as const;
