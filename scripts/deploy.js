const hre = require("hardhat");

async function main() {
  console.log("开始部署 WestendFrequencyCrossChain 合约...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户地址:", deployer.address);
  console.log("账户余额:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const gatewayAddress = process.env.GATEWAY_ADDRESS;
  if (!gatewayAddress) {
    throw new Error("请设置 GATEWAY_ADDRESS 环境变量");
  }
  console.log("Gateway 地址:", gatewayAddress);

  const WestendFrequencyCrossChain = await hre.ethers.getContractFactory("WestendFrequencyCrossChain");
  const contract = await WestendFrequencyCrossChain.deploy(gatewayAddress);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("WestendFrequencyCrossChain 合约部署成功!");
  console.log("合约地址:", contractAddress);
  console.log("部署网络:", (await hre.ethers.provider.getNetwork()).name);
  console.log("区块号:", await hre.ethers.provider.getBlockNumber());

  console.log("\n请将以下内容添加到 .env 文件:");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);

  return contractAddress;
}

main()
  .then((address) => {
    console.log("\n部署完成，合约地址:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
