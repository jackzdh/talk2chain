/**
 * Talk2Chain - 链配置
 * 支持 Polkadot Hub TestNet、Westend、Frequency 和 BSC，同时支持 ZetaChain
 */

import { Chain } from '../types/intent'

export interface ChainConfig {
  chainId: string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}

export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  zetachain: {
    chainId: '0x1b58', // 7000 in hex
    chainName: 'ZetaChain Mainnet',
    nativeCurrency: {
      name: 'ZETA',
      symbol: 'ZETA',
      decimals: 18,
    },
    rpcUrls: ['https://zetachain-evm.blockpi.network/v1/rpc/public'],
    blockExplorerUrls: ['https://zetascan.com'],
  },
  bsc: {
    chainId: '0x38', // 56 in hex
    chainName: 'BNB Smart Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  polkadot: {
    chainId: '0x190F1B45', // 420420421 in hex
    chainName: 'Polkadot Hub TestNet',
    nativeCurrency: {
      name: 'PAS',
      symbol: 'PAS',
      decimals: 18,
    },
    rpcUrls: ['https://westend-asset-hub-eth-rpc.polkadot.io'],
    blockExplorerUrls: ['https://assethub-westend.subscan.io'],
  },
  westend: {
    chainId: '0x7D0', // 2000 in hex
    chainName: 'Westend TestNet',
    nativeCurrency: {
      name: 'WND',
      symbol: 'WND',
      decimals: 18,
    },
    rpcUrls: ['https://westend-rpc.polkadot.io'],
    blockExplorerUrls: ['https://westend.subscan.io'],
  },
  frequency: {
    chainId: '0x7D1', // 2001 in hex
    chainName: 'Frequency TestNet',
    nativeCurrency: {
      name: 'FRQ',
      symbol: 'FRQ',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.testnet.frequency.xyz'],
    blockExplorerUrls: ['https://explorer.testnet.frequency.xyz'],
  },
}

/**
 * 切换到指定链
 */
export async function switchToChain(chain: Chain): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask 未安装')
  }

  const config = CHAIN_CONFIGS[chain]
  const chainId = config.chainId

  console.log(`尝试切换到 ${config.chainName} (Chain ID: ${chainId})...`)

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    })
    console.log(`✓ 成功切换到 ${config.chainName}`)
  } catch (error: any) {
    console.error('切换网络失败:', error)
    if (error.code === 4902) {
      console.log(`链不存在，尝试添加 ${config.chainName}...`)
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: config.chainId,
              chainName: config.chainName,
              nativeCurrency: config.nativeCurrency,
              rpcUrls: config.rpcUrls,
              blockExplorerUrls: config.blockExplorerUrls,
            },
          ],
        })
        console.log(`✓ 成功添加并切换到 ${config.chainName}`)
      } catch (addError: any) {
        console.error('添加网络失败:', addError)
        if (addError.code === 4001) {
          throw new Error(
            `您拒绝了添加 ${config.chainName} 网络。请手动添加网络或重新尝试。\n\n` +
            `网络信息:\n` +
            `- 网络名称: ${config.chainName}\n` +
            `- Chain ID: ${parseInt(chainId, 16)}\n` +
            `- RPC URL: ${config.rpcUrls[0]}\n` +
            `- 代币符号: ${config.nativeCurrency.symbol}`
          )
        }
        throw new Error(`添加 ${config.chainName} 网络失败: ${addError.message || '未知错误'}`)
      }
    } else if (error.code === 4001) {
      throw new Error(
        `您拒绝了切换到 ${config.chainName} 网络。请在 MetaMask 中手动切换网络。`
      )
    } else {
      throw new Error(`切换到 ${config.chainName} 失败: ${error.message || '未知错误'}`)
    }
  }
}

/**
 * 获取链的显示名称
 */
export function getChainDisplayName(chain: Chain): string {
  return CHAIN_CONFIGS[chain].chainName
}

/**
 * 获取网络配置的详细信息（用于手动添加网络）
 */
export function getNetworkConfigDetails(chain: Chain): string {
  const config = CHAIN_CONFIGS[chain]
  const chainIdDecimal = parseInt(config.chainId, 16)
  
  return `
网络配置信息:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
网络名称: ${config.chainName}
Chain ID: ${chainIdDecimal} (十六进制: ${config.chainId})
RPC URL: ${config.rpcUrls[0]}
区块浏览器: ${config.blockExplorerUrls[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
代币信息:
名称: ${config.nativeCurrency.name}
符号: ${config.nativeCurrency.symbol}
精度: ${config.nativeCurrency.decimals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
}

/**
 * 检查当前网络是否为指定链
 */
export async function isCurrentChain(chain: Chain): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return false
  }
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    return chainId === CHAIN_CONFIGS[chain].chainId
  } catch {
    return false
  }
}

