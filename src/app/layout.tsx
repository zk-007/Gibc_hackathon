import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "FlowForge",
  description: "Welcome emails for new leads, sent only after you approve.",
};

const NAV = [
  { href: "/", label: "Workflow" },
  { href: "/simulate", label: "Test" },
  { href: "/report", label: "Report" },
  { href: "/runs", label: "Approvals" },
  { href: "/audit", label: "Activity" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            FlowForge
          </Link>
          <nav className="nav">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
