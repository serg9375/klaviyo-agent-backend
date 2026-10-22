export const metadata = { title: "Billing connector" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ font: "16px system-ui, sans-serif", padding: 16 }}>{children}</body>
    </html>
  );
}
