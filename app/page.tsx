import SimpleChat from '../components/Talk2chainChat'

export default function Home() {
  return (
    <main className="h-screen flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Talk2Chain</h1>
        <p className="text-sm text-gray-600 mt-1">自然语言控制跨链转账</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <SimpleChat />
      </div>
    </main>
  )
}

