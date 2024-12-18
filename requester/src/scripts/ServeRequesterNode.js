import cron from 'node-cron';
import { RequesterNode } from "../classes/RequesterNode.js";

const requesterNode = new RequesterNode(8081);

cron.schedule('*/10 * * * * *', async () => {
  const miningRewardAddress = "adam";
  const newBlock = await requesterNode.blockchain.minePendingTransactions(miningRewardAddress);
  console.log("Mined new block:", newBlock);
  requesterNode.broadcast({ type: "NEW_BLOCK", payload: newBlock });
});