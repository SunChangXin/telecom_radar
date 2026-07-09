import "./globals.css";

export const metadata = {
  title: "通信前沿雷达",
  description: "自动追踪 arXiv、3GPP、ITU、IEEE ComSoc、Ericsson、GitHub 等通信工程前沿动态。",
  icons: {
    icon: "/radar-icon.svg",
    apple: "/radar-icon.svg"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
