import type { Metadata } from "next";
import { headers } from "next/headers";
import { getOrgBySlug } from "@/lib/data";
import "./globals.css";

function extractSlug(host: string): string {
  const hostname = host.split(":")[0];
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return process.env.DEV_ORG_SLUG || "pankonauten";
  }
  const parts = hostname.split(".");
  return parts.length >= 3 ? parts[0] : "pankonauten";
}

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const slug = extractSlug(host);
  const org = await getOrgBySlug(slug);
  const orgName = org?.name || "Kitanaut";
  return {
    title: {
      template: `%s | ${orgName} Finanzen`,
      default: `${orgName} Finanzen`,
    },
    description: `Finance Dashboard für den Vorstand der Kita ${orgName}`,
  };
}

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
