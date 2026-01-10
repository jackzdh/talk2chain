/**
 * Talk2Chain - MetaMask Provider 工具函数
 */

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
    } & {
      on(event: 'accountsChanged', handler: (accounts: string[]) => void): void
      on(event: 'chainChanged', handler: (chainId: string) => void): void
      removeListener(event: 'accountsChanged', handler: (accounts: string[]) => void): void
      removeListener(event: 'chainChanged', handler: (chainId: string) => void): void
    }
  }
}

/**
 * 获取 MetaMask provider
 */
export function getMetaMaskProvider(): Window['ethereum'] | null {
  if (typeof window === 'undefined') return null
  if (!window.ethereum) return null
  if (window.ethereum.isMetaMask === true) return window.ethereum
  return null
}

/**
 * 检查 MetaMask 是否已安装
 */
export function isMetaMaskInstalled(): boolean {
  return getMetaMaskProvider() !== null
}

