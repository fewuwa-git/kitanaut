import type { Metadata } from "next";
import { headers } from "next/headers";
import { getOrgBySlug } from "@/lib/data";
import DemoBanner from "@/components/DemoBanner";
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
  if (slug === "admin") {
    return {
      title: { template: "%s | Kitanaut Admin", default: "Kitanaut Admin" },
      description: "Kitanaut Super-Admin-Bereich",
    };
  }
  if (slug === "demo") {
    return {
      title: { template: "%s | Kita Sonnenschein Demo", default: "Kita Sonnenschein Demo" },
      description: "Demo-Instanz des Kitanaut Finance Dashboards",
    };
  }
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const slug = extractSlug(host);
  const isDemo = slug === "demo";

  return (
    <html lang="de">
      <body>
        {isDemo && <DemoBanner />}
        {isDemo ? <div style={{ paddingTop: "40px" }}>{children}</div> : children}
      </body>
    </html>
  );
}
