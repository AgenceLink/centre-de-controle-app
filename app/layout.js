import "./globals.css";

export const metadata = {
  title: "link — centre de contrôle",
  description: "Pilotage des agents IA de l'agence Link",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
