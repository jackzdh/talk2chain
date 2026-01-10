/**
 * Talk2Chain - 精简的对话前端组件
 * 仅支持 PAS Transfer 和 Polkadot Hub TestNet 跨链到 BSC
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, ExternalLink, Wallet, Copy, CheckCircle } from 'lucide-react'
import { ethers } from 'ethers'
import { parseIntent } from '../lib/llm'
import IntentConfirmation from './IntentConfirmation'
import { Intent } from '../types/intent'
import { executeIntent } from '../lib/blockchain'
import { useWeb3 } from '../hooks/useWeb3'
import { CHAIN_CONFIGS, switchToChain } from '../lib/chains'
import { Chain } from '../types/intent'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  txHash?: string
  error?: string
  intent?: Intent
}

export default function SimpleChat() {
  const { provider, isConnected, account, connect } = useWeb3()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [pendingIntent, setPendingIntent] = useState<Intent | null>(null)
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'waiting-wallet' | 'success' | 'error'>('idle')
  const [executionError, setExecutionError] = useState<string | undefined>()
  const [currentChain, setCurrentChain] = useState<Chain | null>(null)
  const [balance, setBalance] = useState<string>('0')
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 连接钱包并强制切换到 Polkadot Hub TestNet
  const handleConnect = async () => {
    try {
      await connect()
      await switchToChain('polkadot')
    } catch (error: any) {
      console.error('连接钱包失败:', error)
      addMessage({
        role: 'assistant',
        content: `❌ 连接钱包失败: ${error.message || '未知错误'}`,
        error: error.message || 'Unknown error',
      })
    }
  }

  // 复制地址到剪贴板
  const handleCopyAddress = async () => {
    if (account) {
      try {
        await navigator.clipboard.writeText(account)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('复制失败:', error)
      }
    }
  }

  // 获取当前网络
  useEffect(() => {
    if (!provider || !isConnected) {
      setCurrentChain(null)
      setBalance('0')
      return
    }

    const updateCurrentChain = async () => {
      try {
        const network = await provider.getNetwork()
        const chainIdBigInt = network.chainId
        const chainIdHex = `0x${chainIdBigInt.toString(16).padStart(2, '0')}`
        const chainIdDecimal = chainIdBigInt.toString()
        
        console.log('当前网络 Chain ID:', {
          hex: chainIdHex,
          decimal: chainIdDecimal
        })

        const chain = Object.keys(CHAIN_CONFIGS).find((key) => {
          const config = CHAIN_CONFIGS[key as Chain]
          const configChainIdHex = config.chainId.toLowerCase()
          const configChainIdDecimal = BigInt(config.chainId).toString()
          
          return configChainIdHex === chainIdHex || 
                 configChainIdDecimal === chainIdDecimal
        }) as Chain | undefined
        
        console.log('识别到的链:', chain)
        setCurrentChain(chain || null)
      } catch (error) {
        console.error('获取当前网络失败:', error)
        setCurrentChain(null)
      }
    }

    const updateBalance = async () => {
      if (!account) {
        console.log('没有账户，无法获取余额')
        return
      }
      try {
        console.log('开始获取余额，账户:', account)
        
        // 重新获取 provider 以确保使用最新的网络配置
        if (typeof window !== 'undefined' && window.ethereum) {
          const newProvider = new ethers.BrowserProvider(window.ethereum)
          const balance = await newProvider.getBalance(account)
          const formattedBalance = ethers.formatEther(balance)
          console.log('余额:', formattedBalance)
          setBalance(parseFloat(formattedBalance).toFixed(4))
        } else {
          const balance = await provider.getBalance(account)
          const formattedBalance = ethers.formatEther(balance)
          console.log('余额:', formattedBalance)
          setBalance(parseFloat(formattedBalance).toFixed(4))
        }
      } catch (error: any) {
        console.error('获取余额失败:', error)
        console.error('错误详情:', {
          message: error.message,
          code: error.code,
          data: error.data
        })
        setBalance('0')
      }
    }

    updateCurrentChain().then(() => {
      updateBalance()
    })
  }, [provider, isConnected, account])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>): Message => {
    const newMessage: Message = {
      ...message,
      id: 'msg-' + Date.now(),
      timestamp: new Date(),
    }
    if (message.txHash) {
      console.log('交易哈希:', message.txHash)
    }
    setMessages((prev) => [...prev, newMessage])
    return newMessage
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userInput = input.trim()
    setInput('')
    setIsLoading(true)

    // 添加用户消息
    addMessage({
      role: 'user',
      content: userInput,
    })

    // 检查钱包连接
    if (!isConnected || !provider) {
      addMessage({
        role: 'assistant',
        content: '❌ 请先连接 MetaMask 钱包',
        error: 'Wallet not connected',
      })
      setIsLoading(false)
      return
    }

    // 调用 LLM 解析意图
    try {
      const intent = await parseIntent(userInput, currentChain || undefined)
      
      // 添加助手消息
      addMessage({
        role: 'assistant',
        content: `已识别意图: ${intent.action}。请确认操作详情。`,
        intent,
      })
      
      setPendingIntent(intent)
      setExecutionStatus('idle')
      setExecutionError(undefined)
      setIsExecuting(false)
    } catch (error: any) {
      console.error('解析意图失败:', error)
      addMessage({
        role: 'assistant',
        content: `❌ ${error.message || '解析意图失败'}`,
        error: error.message || 'Unknown error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmIntent = async (intent: Intent) => {
    if (!provider) {
      addMessage({
        role: 'assistant',
        content: '❌ 钱包未连接',
        error: 'Wallet not connected',
      })
      setPendingIntent(null)
      return
    }

    setPendingIntent(null)
    setIsExecuting(true)
    setExecutionStatus('idle')
    setExecutionError(undefined)
    
    addMessage({
      role: 'assistant',
      content: '✅ 已确认，正在执行...',
    })
    
    try {
      // 重新获取 provider 以确保使用最新的网络配置
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask 未安装')
      }
      const newProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await newProvider.getSigner()
      const txHash = await executeIntent(intent, newProvider, signer)
      
      setExecutionStatus('success')
      
      // 更新余额
      if (account) {
        const newBalance = await newProvider.getBalance(account)
        const formattedBalance = ethers.formatEther(newBalance)
        setBalance(parseFloat(formattedBalance).toFixed(4))
      }
      
      const isCrossChain = intent.action === 'cross_chain_transfer'
      const successContent = isCrossChain
        ? `✅ 跨链转账成功！\n\n第一步（源链锁定）已完成。\n第二步（目标链铸造）将由器Z通常aChain需要几分钟。\n\n交易哈希: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
        : `✅ 转账成功！\n\n交易哈希: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`
      
      addMessage({
        role: 'assistant',
        content: successContent,
        txHash,
      })
      
      // 3秒后关闭弹窗
      setTimeout(() => {
        setIsExecuting(false)
        setPendingIntent(null)
      }, 3000)
    } catch (error: any) {
      console.error('执行链上操作失败:', error)
      setExecutionStatus('error')
      setExecutionError(error.message)
      
      let errorMessage = error.message || '未知错误'
      
      if (errorMessage.includes('拒绝了添加') || errorMessage.includes('拒绝了切换')) {
        errorMessage = `⚠️ 网络操作被拒绝\n\n${errorMessage}\n\n请重新尝试操作，或手动在 MetaMask 中添加/切换网络。`
      } else if (errorMessage.includes('余额不足')) {
        errorMessage = `💰 ${errorMessage}\n\n请确保您的账户有足够的余额。`
      } else if (errorMessage.includes('MetaMask 未安装')) {
        errorMessage = `🦊 ${errorMessage}\n\n请先安装 MetaMask 浏览器扩展。`
      } else if (errorMessage.includes('network changed')) {
        errorMessage = `⚠️ 网络已更改，请重新尝试操作。`
      }
      
      addMessage({
        role: 'assistant',
        content: `❌ 操作失败\n\n${errorMessage}`,
        error: error.message || 'Unknown error',
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCancelIntent = () => {
    setPendingIntent(null)
    setExecutionStatus('idle')
    setExecutionError(undefined)
    setIsExecuting(false)
    addMessage({
      role: 'assistant',
      content: '❌ 操作已取消',
    })
  }

  return (
    <>
      <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
        {/* 钱包连接状态栏 */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected && account ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">已连接</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-mono text-gray-700">
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="复制地址"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">
                    网络: {currentChain ? CHAIN_CONFIGS[currentChain].chainName : '未知网络'}
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-xs font-medium text-blue-900">
                      余额: {balance} {currentChain ? CHAIN_CONFIGS[currentChain].nativeCurrency.symbol : 'ETH'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Wallet className="w-4 h-4" />
                连接 MetaMask
              </button>
            )}
          </div>
        </div>

        {/* 聊天消息区域 */}
        <div className="overflow-y-auto p-4 space-y-4 bg-gray-50 flex-1">
          {/* 欢迎消息 */}
          {messages.length === 0 && (
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-gray-800">
                    您好！我是 Talk2Chain AI 助手。
                    <br />
                    我可以帮您：
                    <br />
                    • 在 Polkadot Hub TestNet 上转账 PAS
                    <br />
                    • 从 Polkadot Hub TestNet 跨链转账 PAS 到 BSC
                    <br />
                    • 在 Polkadot 上转账 PAS
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 消息列表 */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-2.5 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {message.role === 'user' ? (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
              )}
              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block px-4 py-2.5 max-w-[75%] rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    <p>{message.content}</p>
                  </div>
                  {message.txHash && (
                    <div className="mt-2">
                      <a
                        href={`https://assethub-westend.subscan.io/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline flex items-center gap-1 text-blue-600"
                      >
                        查看交易
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 加载状态 */}
          {isLoading && (
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          {!isConnected ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500 mb-2">请先连接钱包</p>
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                连接 MetaMask
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="输入您的请求，例如：转 0.6 PAS 到 0x..."
                disabled={isLoading || isExecuting}
                rows={1}
                className="flex-1 resize-none outline-none text-gray-800 placeholder-gray-400 text-sm bg-white border border-gray-300 rounded-lg px-4 py-2 disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || isExecuting || !input.trim()}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 意图确认弹窗 */}
      {pendingIntent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 border-2 border-gray-200 shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">确认操作</h3>
            <IntentConfirmation
              intent={pendingIntent}
              onConfirm={handleConfirmIntent}
              onCancel={handleCancelIntent}
              isExecuting={isExecuting}
              executionStatus={executionStatus}
              errorMessage={executionError}
            />
          </div>
        </div>
      )}
    </>
  )
}

