const hre = require("hardhat");

async function main() {
  console.log("🔍 开始验证已部署的合约...\n");

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("请设置 CONTRACT_ADDRESS 环境变量");
  }
  console.log("合约地址:", contractAddress);

  const [signer] = await hre.ethers.getSigners();
  console.log("验证账户地址:", signer.address);

  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "PAS\n");

  const WestendFrequencyCrossChain = await hre.ethers.getContractFactory("WestendFrequencyCrossChain");
  const contract = WestendFrequencyCrossChain.attach(contractAddress);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 合约基本信息验证");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const gatewayAddress = await contract.getGatewayAddress();
    console.log("✅ Gateway 地址:", gatewayAddress);

    const supportedChains = await contract.getSupportedChains();
    console.log("✅ 支持的链 ID:", supportedChains.map(id => id.toString()));

    const WESTEND_CHAIN_ID = await contract.WESTEND_CHAIN_ID();
    console.log("✅ Westend Chain ID:", WESTEND_CHAIN_ID.toString());

    const FREQUENCY_CHAIN_ID = await contract.FREQUENCY_CHAIN_ID();
    console.log("✅ Frequency Chain ID:", FREQUENCY_CHAIN_ID.toString());

    const MIN_CROSS_CHAIN_AMOUNT = await contract.MIN_CROSS_CHAIN_AMOUNT();
    console.log("✅ 最小跨链金额:", hre.ethers.formatEther(MIN_CROSS_CHAIN_AMOUNT), "PAS");

    const DESTINATION_GAS_LIMIT = await contract.DESTINATION_GAS_LIMIT();
    console.log("✅ 目标 Gas 限制:", DESTINATION_GAS_LIMIT.toString());
  } catch (error) {
    console.error("❌ 基本信息验证失败:", error.message);
    return;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💰 合约余额验证");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const contractBalance = await hre.ethers.provider.getBalance(contractAddress);
    console.log("✅ 合约余额:", hre.ethers.formatEther(contractBalance), "PAS");
  } catch (error) {
    console.error("❌ 余额查询失败:", error.message);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 功能测试");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const testAmount = hre.ethers.parseEther("0.01");
    const testAddress = signer.address;
    const testAddressBytes = hre.ethers.zeroPadValue(testAddress, 20);

    console.log("\n测试 1: 检查最小金额验证");
    try {
      const tx = await contract.crossChainTransfer(
        testAddressBytes,
        2000,
        "Westend",
        { value: hre.ethers.parseEther("0.005") }
      );
      await tx.wait();
      console.log("❌ 应该拒绝低于最小金额的转账");
    } catch (error) {
      if (error.message.includes("Amount below minimum")) {
        console.log("✅ 正确拒绝了低于最小金额的转账");
      } else {
        console.log("⚠️  错误:", error.message);
      }
    }

    console.log("\n测试 2: 检查无效地址长度验证");
    try {
      const tx = await contract.crossChainTransfer(
        "0x1234",
        2000,
        "Westend",
        { value: testAmount }
      );
      await tx.wait();
      console.log("❌ 应该拒绝无效的地址长度");
    } catch (error) {
      if (error.message.includes("Invalid destination address length")) {
        console.log("✅ 正确拒绝了无效的地址长度");
      } else {
        console.log("⚠️  错误:", error.message);
      }
    }

    console.log("\n测试 3: 检查不支持的链 ID");
    try {
      const tx = await contract.crossChainTransfer(
        testAddressBytes,
        9999,
        "Unknown",
        { value: testAmount }
      );
      await tx.wait();
      console.log("❌ 应该拒绝不支持的链 ID");
    } catch (error) {
      if (error.message.includes("Unsupported destination chain")) {
        console.log("✅ 正确拒绝了不支持的链 ID");
      } else {
        console.log("⚠️  错误:", error.message);
      }
    }

    console.log("\n测试 4: 检查 receive() 函数");
    try {
      const tx = await signer.sendTransaction({
        to: contractAddress,
        value: hre.ethers.parseEther("0.001")
      });
      await tx.wait();
      console.log("✅ 成功通过 receive() 函数发送 ETH");
    } catch (error) {
      console.log("⚠️  receive() 函数测试失败:", error.message);
    }

  } catch (error) {
    console.error("❌ 功能测试失败:", error.message);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 网络信息");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const network = await hre.ethers.provider.getNetwork();
    console.log("网络名称:", network.name);
    console.log("Chain ID:", network.chainId.toString());
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log("当前区块:", blockNumber);
  } catch (error) {
    console.error("❌ 网络信息获取失败:", error.message);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ 验证完成！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => {
    console.log("\n🎉 所有验证测试已完成！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 验证失败:", error);
    process.exit(1);
  });
