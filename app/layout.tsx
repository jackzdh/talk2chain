import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Talk2Chain - 自然语言控制跨链转账',
  description: '使用 Qwen3 Agent 识别用户意图并执行跨链转账',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

