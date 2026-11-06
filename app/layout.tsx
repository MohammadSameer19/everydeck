import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Every Deck — All 52! orderings of a deck of cards",
  description:
    "Every one of the 52! orderings of a deck of playing cards, addressable by a single integer. " +
    "No database: any deck is reconstructed from its index on demand.",
  openGraph: {
    title: "Every Deck",
    description: "52! = 8.07e+67. Every one of them, addressed by an integer.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3efe6",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
