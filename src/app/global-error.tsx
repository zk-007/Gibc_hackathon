"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body>
        <p>Something went wrong.</p>
        <p>{error.message}</p>
      </body>
    </html>
  );
}
