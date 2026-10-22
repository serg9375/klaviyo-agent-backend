import "./styles.css";

const DESCRIPTION = "Paste one sentence into your assistant and it explains your Klaviyo bill in plain words.";

export const metadata = {
  title: "Understand your Klaviyo bill",
  description: DESCRIPTION,
  openGraph: { title: "Understand your Klaviyo bill", description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="llms.txt" href="/llms.txt" />
      </head>
      <body>{children}</body>
    </html>
  );
}
