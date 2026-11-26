import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f0f',
        color: '#ffffff',
        fontFamily: '"Epilogue", ui-sans-serif, system-ui, sans-serif',
        padding: '24px',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      <style>{`html,body{margin:0;padding:0;background:#0f0f0f;color:#ffffff;}`}</style>
      <div
        style={{
          maxWidth: '448px',
          width: '100%',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backgroundColor: '#1a1a1a',
          padding: '28px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#dafa9c',
          }}
        >
          HTTP 404 · Route Not Found
        </p>
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: '24px',
            lineHeight: 1.2,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          Part or Comparison Not Found
        </h1>
        <p
          style={{
            margin: '0 0 22px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#8f8f8f',
          }}
        >
          The requested OPN datasheet or cross-reference URL is not in the current verified index.
          Use the parametric catalog to locate exact orderable part numbers.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <Link
            href="/en/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '9999px',
              backgroundColor: '#dafa9c',
              color: '#0f0f0f',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Go to Home (/en/)
          </Link>
          <Link
            href="/en/catalog/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'transparent',
              color: '#ffffff',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Browse Catalog
          </Link>
        </div>
      </div>
    </main>
  );
}
