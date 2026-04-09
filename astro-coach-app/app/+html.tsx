import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Root HTML shell for the Expo web/PWA build.
 * Adds Apple PWA meta tags so Safari keeps all navigation inside the standalone shell.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Apple PWA — critical for Safari standalone mode on all screens */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Akhtar" />

        {/* Apple touch icons */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />

        {/* Theme color */}
        <meta name="theme-color" content="#0f172a" />

        {/* Prevent scroll bounce on web */}
        <ScrollViewStyleReset />

        {/* Prevent address bar color flash */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                background-color: #0f172a;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
