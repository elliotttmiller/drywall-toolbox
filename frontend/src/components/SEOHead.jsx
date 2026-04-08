/**
 * frontend/src/components/SEOHead.jsx
 *
 * Reusable document-head manager powered by react-helmet-async.
 * Drop this component anywhere in a page tree to control that page's
 * <title>, meta tags, Open Graph, Twitter Card, JSON-LD structured data,
 * and resource hints.
 *
 * Props:
 *   title       {string}          — page title (appended with "| Drywall Toolbox")
 *   description {string}          — meta description (truncated to 160 chars)
 *   canonical   {string}          — canonical URL override
 *   og          {object}          — Open Graph overrides: { type, image, imageAlt }
 *   schema      {object|object[]} — JSON-LD schema block(s) to inject
 *   noindex     {boolean}         — emit noindex, nofollow when true
 *   links       {object[]}        — extra <link> tag objects: [{ rel, href, as, type, crossOrigin }]
 */
import { Helmet } from 'react-helmet-async';

const SITE_NAME      = 'Drywall Toolbox';
const SITE_URL       = 'https://drywalltoolbox.com';
const DEFAULT_OG_IMG = `${SITE_URL}/logo-white.svg`;
const MAX_DESC_LEN   = 160;

export default function SEOHead({
  title       = '',
  description = '',
  canonical   = '',
  og          = {},
  schema      = null,
  noindex     = false,
  links       = [],
}) {
  // Build final title
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : SITE_NAME;

  // Truncate description
  const safeDesc = description.length > MAX_DESC_LEN
    ? `${description.slice(0, MAX_DESC_LEN - 1)}…`
    : description;

  // Canonical URL
  const canonicalUrl = canonical || (typeof window !== 'undefined' ? window.location.href : SITE_URL);

  // Open Graph
  const ogType     = og.type     || 'website';
  const ogImage    = og.image    || DEFAULT_OG_IMG;
  const ogImageAlt = og.imageAlt || SITE_NAME;

  // Normalise schema to an array so we can render multiple blocks
  const schemas = schema
    ? (Array.isArray(schema) ? schema : [schema]).filter(Boolean)
    : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={safeDesc} />

      {/* Robots */}
      {noindex
        ? <meta name="robots" content="noindex, nofollow" />
        : <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      }

      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type"        content={ogType} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={safeDesc} />
      <meta property="og:url"         content={canonicalUrl} />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:image"       content={ogImage} />
      <meta property="og:image:alt"   content={ogImageAlt} />

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={safeDesc} />
      <meta name="twitter:image"       content={ogImage} />
      <meta name="twitter:image:alt"   content={ogImageAlt} />

      {/* Extra link tags (preload, preconnect, etc.) */}
      {links.map((linkProps, i) => {
        const { rel, href, as: asAttr, type: typeAttr, crossOrigin, ...rest } = linkProps;
        return (
          <link
            key={i}
            rel={rel}
            href={href}
            {...(asAttr      ? { as: asAttr }              : {})}
            {...(typeAttr    ? { type: typeAttr }           : {})}
            {...(crossOrigin ? { crossOrigin: crossOrigin } : {})}
            {...rest}
          />
        );
      })}

      {/* JSON-LD structured data */}
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </Helmet>
  );
}
