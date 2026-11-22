export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
