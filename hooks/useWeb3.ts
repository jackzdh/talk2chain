/**
 * Talk2Chain - Web3 Hook
 * 精简版 MetaMask 连接管理
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { getMetaMaskProvider } from '../lib/metamask'

export function useWeb3() {
  const [account, setAccount] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const metaMaskProvider = getMetaMaskProvider()
    if (!metaMaskProvider) return

    // 检查是否已连接
    const checkConnection = async () => {
      try {
        const accounts = await metaMaskProvider.request({
          method: 'eth_accounts',
        }) as string[]
        
        if (accounts.length > 0) {
          setAccount(accounts[0])
          setIsConnected(true)
          setProvider(new ethers.BrowserProvider(metaMaskProvider))
        }
      } catch (error) {
        console.error('检查连接失败:', error)
      }
    }

    checkConnection()

    // 监听账户变化
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null)
        setIsConnected(false)
        setProvider(null)
      } else {
        setAccount(accounts[0])
        setIsConnected(true)
        setProvider(new ethers.BrowserProvider(metaMaskProvider))
      }
    }

    // 监听链变化
    const handleChainChanged = () => {
      setProvider(new ethers.BrowserProvider(metaMaskProvider))
    }

    metaMaskProvider.on('accountsChanged', handleAccountsChanged)
    metaMaskProvider.on('chainChanged', handleChainChanged)

    return () => {
      metaMaskProvider.removeListener('accountsChanged', handleAccountsChanged)
      metaMaskProvider.removeListener('chainChanged', handleChainChanged)
    }
  }, [])

  const connect = useCallback(async () => {
    const metaMaskProvider = getMetaMaskProvider()
    
    if (!metaMaskProvider) {
      alert('请安装并启用 MetaMask 扩展')
      return
    }

    try {
      console.log('正在请求 MetaMask 账户授权...')
      await metaMaskProvider.request({
        method: 'eth_requestAccounts',
      })
      
      const accounts = await metaMaskProvider.request({
        method: 'eth_accounts',
      }) as string[]
      
      if (accounts.length > 0) {
        console.log('✓ 成功连接到账户:', accounts[0])
        setAccount(accounts[0])
        setIsConnected(true)
        setProvider(new ethers.BrowserProvider(metaMaskProvider))
      }
    } catch (error: any) {
      console.error('连接失败:', error)
      if (error.code === 4001) {
        alert('您拒绝了连接请求，请重试')
      } else if (error.code === -32002) {
        alert('请先在 MetaMask 中完成之前的请求')
      } else {
        alert(`连接 MetaMask 失败: ${error.message || '未知错误'}，请重试`)
      }
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
    setIsConnected(false)
    setProvider(null)
  }, [])

  return {
    account,
    isConnected,
    provider,
    connect,
    disconnect,
  }
}

