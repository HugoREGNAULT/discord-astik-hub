import { spawn } from "child_process";

async function run(name, command, args) {
  console.log(`\n========== ${name} ==========\n`);
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: "inherit", shell: true });
    proc.on("close", (code) => resolve(code));
  });
}

async function main() {
  const mode = process.argv.includes("--mode=development") ? "development" : "production";
  const viteArgs =
    mode === "development" ? ["vite", "build", "--mode", "development"] : ["vite", "build"];

  const tscCode = await run("TypeScript", "npx", ["tsc", "--noEmit"]);
  const eslintCode = await run("ESLint", "npx", ["eslint", "."]);
  const viteCode = await run("Vite", "npx", viteArgs);

  console.log("\n========== BUILD SUMMARY ==========");
  console.log(`TypeScript : ${tscCode === 0 ? "PASS" : `FAIL (exit ${tscCode})`}`);
  console.log(`ESLint     : ${eslintCode === 0 ? "PASS" : `FAIL (exit ${eslintCode})`}`);
  console.log(`Vite       : ${viteCode === 0 ? "PASS" : `FAIL (exit ${viteCode})`}`);

  const overall = tscCode || eslintCode || viteCode;
  process.exit(overall);
}

main();
