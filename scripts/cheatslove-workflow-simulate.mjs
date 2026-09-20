import { runCheatsLoveWorkflowSimulation } from "../finance/cheatslove-workflow.mjs";

const amountCents = Math.max(0, Math.round(Number(process.argv[2] || 0) * 100));
const result = await runCheatsLoveWorkflowSimulation({ amountCents, simulation: true });
console.log(JSON.stringify(result, null, 2));
if (result.status === "NEEDS_ATTENTION") process.exitCode = 2;
