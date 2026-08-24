import type { Metadata, Viewport } from "next";
import { Calistoga, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppChrome from "@/components/AppChrome";

// Runs before paint so the saved theme applies with no light->dark flash,
// and so vibrancy's transparent-body CSS (globals.css) only kicks in under
// Electron. window.tempo is injected by the preload script, which runs
// before any of the page's own scripts, so it's reliably present here.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}try{if(window.tempo)document.documentElement.dataset.desktop="";}catch(e){}})();`;

// SF Pro (system font on macOS) carries the workhorse duties; Calistoga is
// the personality voice, used only for headlines; JetBrains Mono for the
// small technical labels.
const calistoga = Calistoga({
  variable: "--font-calistoga",
  subsets: ["latin"],
  weight: "400",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Today", template: "%s · Tempo" },
  description: "What you're actually doing today, and whether it fits.",
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${calistoga.variable} ${jetbrains.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
