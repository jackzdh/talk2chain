/**
 * Talk2Chain - 区块链操作执行逻辑
 * 支持 Westend <-> Frequency 跨链转账、Polkadot Hub TestNet -> BSC 跨链转账，同时支持 polkadot Transfer
 */

import { Intent, Chain } from '../types/intent'
import { ethers } from 'ethers'
import { switchToChain } from './chains'
import { 
  westendFrequencyCrossChainTransfer, 
  polkadotCrossChainTransfer,
  polkadotToWestendFrequencyCrossChainTransfer
} from './polkachain'

/**
 * 执行链上操作
 */
export async function executeIntent(
  intent: Intent,
  provider: ethers.BrowserProvider,
  signer: ethers.JsonRpcSigner
): Promise<string> {
  console.log('执行意图:', intent)

  // 跨链转账：Westend <-> Frequency
  if (intent.action === 'cross_chain_transfer' && 
      ((intent.fromChain === 'westend' && intent.toChain === 'frequency') ||
       (intent.fromChain === 'frequency' && intent.toChain === 'westend'))) {
    return await westendFrequencyCrossChainTransfer(intent, provider, signer)
  }

  // 跨链转账：Polkadot Hub TestNet -> BSC
  if (intent.action === 'cross_chain_transfer' && 
      intent.fromChain === 'polkadot' && 
      intent.toChain === 'bsc') {
    return await polkadotCrossChainTransfer(intent, provider, signer)
  }

  // 跨链转账：Polkadot Hub TestNet -> Westend/Frequency
  if (intent.action === 'cross_chain_transfer' && 
      intent.fromChain === 'polkadot' && 
      (intent.toChain === 'westend' || intent.toChain === 'frequency')) {
    return await polkadotToWestendFrequencyCrossChainTransfer(intent, provider, signer)
  }

  // 链内转账：Polkadot Hub TestNet 上的 PAS 转账
  if (intent.action === 'transfer' && intent.fromChain === 'polkadot') {
    return await handlePolkadotTransfer(intent, provider, signer)
  }

  // 链内转账：Westend 上的 WND 转账
  if (intent.action === 'transfer' && intent.fromChain === 'westend') {
    return await handleWestendTransfer(intent, provider, signer)
  }

  // 链内转账：Frequency 上的 FRQ 转账
  if (intent.action === 'transfer' && intent.fromChain === 'frequency') {
    return await handleFrequencyTransfer(intent, provider, signer)
  }

  throw new Error(`不支持的操作: ${intent.action}`)
}

/**
 * 处理 Polkadot Hub TestNet 上的 PAS 转账
 */
async function handlePolkadotTransfer(
  intent: Intent,
  provider: ethers.BrowserProvider,
  signer: ethers.JsonRpcSigner
): Promise<string> {
  console.log('处理 PAS 转账:', intent)

  if (!intent.amount) {
    throw new Error('缺少转账金额')
  }

  console.log('准备切换到 Polkadot Hub TestNet...')
  await switchToChain('polkadot')
  console.log('✓ 网络切换成功')
  
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask 未安装')
  }
  const newProvider = new ethers.BrowserProvider(window.ethereum)
  const newSigner = await newProvider.getSigner()

  const userAddress = await newSigner.getAddress()
  console.log('用户地址:', userAddress)
  const recipientAddress = intent.recipient || userAddress
  console.log('接收地址:', recipientAddress)

  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`接收地址格式不正确: ${recipientAddress}`)
  }

  const amount = ethers.parseEther(intent.amount)
  console.log('转账金额:', ethers.formatEther(amount), 'PAS')

  const balance = await newProvider.getBalance(userAddress)
  console.log('当前余额:', ethers.formatEther(balance), 'PAS')
  
  const gasEstimate = BigInt(21000)
  const gasPrice = (await newProvider.getFeeData()).gasPrice || BigInt(10000100000)
  console.log('Gas 价格:', ethers.formatUnits(gasPrice, 'gwei'), 'Gwei')
  
  const gasFee = gasEstimate * gasPrice
  console.log('预计 Gas 费用:', ethers.formatEther(gasFee), 'PAS')
  
  const requiredAmount = amount + gasFee
  console.log('总需要金额:', ethers.formatEther(requiredAmount), 'PAS')

  if (balance < requiredAmount) {
    throw new Error(
      `余额不足。需要: ${ethers.formatEther(requiredAmount)} PAS，当前: ${ethers.formatEther(balance)} PAS`
    )
  }

  console.log('准备发送交易...')
  console.log('⏳ 请在 MetaMask 中确认交易...')
  
  try {
    const tx = await Promise.race([
      newSigner.sendTransaction({
        to: recipientAddress,
        value: amount,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('交易确认超时（5分钟）')), 5 * 60 * 1000)
      )
    ]) as ethers.ContractTransactionResponse
    
    console.log('✓ PAS 转账交易已发送:', tx.hash)

    let receipt: ethers.TransactionReceipt | null = null
    let retries = 5
    let delay = 2000

    while (retries > 0 && !receipt) {
      try {
        receipt = await tx.wait()
        break
      } catch (error: any) {
        if (error.code === -32005 || error.message?.includes('rate limit')) {
          console.warn(`RPC 速率限制，等待 ${delay/1000} 秒后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= 2
          retries--
          if (retries === 0) {
            return tx.hash
          }
          continue
        }
        throw error
      }
    }

    if (receipt && receipt.status === 0) {
      throw new Error('交易执行失败')
    }

    return receipt?.hash || tx.hash
  } catch (error: any) {
    console.error('发送交易失败:', error)
    if (error.code === 4001) {
      throw new Error('您在 MetaMask 中拒绝了交易')
    } else if (error.code === -32603) {
      throw new Error('钱包授权失败，请检查网络连接和账户状态')
    } else if (error.code === -32002) {
      throw new Error('请先在 MetaMask 中完成之前的请求')
    } else if (error.message?.includes('超时')) {
      throw new Error('交易确认超时，请检查 MetaMask 是否弹出确认窗口')
    } else if (error.message?.includes('insufficient funds')) {
      throw new Error('账户余额不足以支付 Gas 费用')
    } else if (error.message?.includes('nonce')) {
      throw new Error('交易 nonce 错误，请稍后重试')
    } else {
      throw new Error(`交易失败: ${error.message || '未知错误'} (错误代码: ${error.code || 'N/A'})`)
    }
  }
}

/**
 * 处理 Westend 上的 WND 转账
 */
async function handleWestendTransfer(
  intent: Intent,
  provider: ethers.BrowserProvider,
  signer: ethers.JsonRpcSigner
): Promise<string> {
  console.log('处理 WND 转账:', intent)

  if (!intent.amount) {
    throw new Error('缺少转账金额')
  }

  await switchToChain('westend')
  
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask 未安装')
  }
  const newProvider = new ethers.BrowserProvider(window.ethereum)
  const newSigner = await newProvider.getSigner()

  const userAddress = await newSigner.getAddress()
  const recipientAddress = intent.recipient || userAddress

  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`接收地址格式不正确: ${recipientAddress}`)
  }

  const amount = ethers.parseEther(intent.amount)

  const balance = await newProvider.getBalance(userAddress)
  const gasEstimate = BigInt(21000)
  const gasPrice = (await newProvider.getFeeData()).gasPrice || BigInt(10000100000)
  const gasFee = gasEstimate * gasPrice
  const requiredAmount = amount + gasFee

  if (balance < requiredAmount) {
    throw new Error(
      `余额不足。需要: ${ethers.formatEther(requiredAmount)} WND，当前: ${ethers.formatEther(balance)} WND`
    )
  }

  const tx = await newSigner.sendTransaction({
    to: recipientAddress,
    value: amount,
  })

  console.log('WND 转账交易已发送:', tx.hash)

  let receipt: ethers.TransactionReceipt | null = null
  let retries = 5
  let delay = 2000

  while (retries > 0 && !receipt) {
    try {
      receipt = await tx.wait()
      break
    } catch (error: any) {
      if (error.code === -32005 || error.message?.includes('rate limit')) {
        console.warn(`RPC 速率限制，等待 ${delay/1000} 秒后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2
        retries--
        if (retries === 0) {
          return tx.hash
        }
        continue
      }
      throw error
    }
  }

  if (receipt && receipt.status === 0) {
    throw new Error('交易执行失败')
  }

  return receipt?.hash || tx.hash
}

/**
 * 处理 Frequency 上的 FRQ 转账
 */
async function handleFrequencyTransfer(
  intent: Intent,
  provider: ethers.BrowserProvider,
  signer: ethers.JsonRpcSigner
): Promise<string> {
  console.log('处理 FRQ 转账:', intent)

  if (!intent.amount) {
    throw new Error('缺少转账金额')
  }

  await switchToChain('frequency')
  
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask 未安装')
  }
  const newProvider = new ethers.BrowserProvider(window.ethereum)
  const newSigner = await newProvider.getSigner()

  const userAddress = await newSigner.getAddress()
  const recipientAddress = intent.recipient || userAddress

  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`接收地址格式不正确: ${recipientAddress}`)
  }

  const amount = ethers.parseEther(intent.amount)

  const balance = await newProvider.getBalance(userAddress)
  const gasEstimate = BigInt(21000)
  const gasPrice = (await newProvider.getFeeData()).gasPrice || BigInt(10000100000)
  const gasFee = gasEstimate * gasPrice
  const requiredAmount = amount + gasFee

  if (balance < requiredAmount) {
    throw new Error(
      `余额不足。需要: ${ethers.formatEther(requiredAmount)} FRQ，当前: ${ethers.formatEther(balance)} FRQ`
    )
  }

  const tx = await newSigner.sendTransaction({
    to: recipientAddress,
    value: amount,
  })

  console.log('FRQ 转账交易已发送:', tx.hash)

  let receipt: ethers.TransactionReceipt | null = null
  let retries = 5
  let delay = 2000

  while (retries > 0 && !receipt) {
    try {
      receipt = await tx.wait()
      break
    } catch (error: any) {
      if (error.code === -32005 || error.message?.includes('rate limit')) {
        console.warn(`RPC 速率限制，等待 ${delay/1000} 秒后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2
        retries--
        if (retries === 0) {
          return tx.hash
        }
        continue
      }
      throw error
    }
  }

  if (receipt && receipt.status === 0) {
    throw new Error('交易执行失败')
  }

  return receipt?.hash || tx.hash
}

