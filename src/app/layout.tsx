import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pankonauten Finanzen",
  description: "Finance Dashboard für den Vorstand der Kita Pankonauten",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
