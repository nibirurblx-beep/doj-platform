import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Department of Justice",
    template: "%s | Department of Justice",
  },
  description:
    "Official website of the DoJ OSFUSA roleplay community. " +
    "A fictional platform. Not affiliated with the United States Government, " +
    "the United States Department of Justice, Roblox Corporation or Discord.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
