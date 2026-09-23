"use client";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <main style={{ padding: "2rem" }}>
      <p>Something went wrong.</p>
      <p>{error.message}</p>
    </main>
  );
}
