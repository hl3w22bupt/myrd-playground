#!/usr/bin/env node
// 契约检查分发器 —— 两种调用口径共用一个入口：
// 1. 带参数（routines.yaml game-contract 门禁：--spec <path> --project <dir>）
//    → 统一门禁版（contract-check-unified.mjs，实体/关卡/数值存在性核对）。
// 2. 裸调用（stack-tower 提交前置：node scripts/contract-check.mjs）
//    → stack-tower A–E 版（contract-check-stack-tower.mjs，spec↔工程一致性 + acceptance 实跑）。
// 两份实现原样保留，勿在本文件里加逻辑；改动对应实现后于黑板 blockers.md 记一行。
const args = process.argv.slice(2);
const routineMode = args.includes('--spec') || args.includes('--project');
await import(routineMode ? './contract-check-unified.mjs' : './contract-check-stack-tower.mjs');
