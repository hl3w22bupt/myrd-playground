/**
 * #apphost 平台 shim —— 从 process.env 读取平台注入物，类型按 defs/runtime.ts 声明收窄。
 *
 * 用法：
 *   import { vars, secrets, ctx } from "#apphost";
 *   const level = vars.LOG_LEVEL;        // 仅声明的 key 可用
 *   const key = secrets.EXAMPLE_API_KEY; // 值由人填写，构建期不存在
 *
 * 安全说明：secrets 仅在「运行实例」的 env 中有值；构建沙盒（tsc/esbuild 阶段）
 * 不注入任何 secret —— 代码不能也不需要在构建期读到明文。
 */

import { SECRET_KEYS, VAR_KEYS } from "../defs/runtime";

type EnvOf<K extends readonly string[]> = { [P in K[number]]: string };

function pickEnv<K extends readonly string[]>(keys: K): EnvOf<K> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined) out[k] = v;
  }
  // 类型承诺：声明过的 key 可访问。运行时未注入（如 secret 未填值）时值为 undefined，
  // 调用方须做 `?? 默认值` 防御 —— 与 EdgeSpark 的 vars/secrets 语义一致。
  return out as EnvOf<K>;
}

/** 明文环境变量（类型收窄到 VAR_KEYS 声明集） */
export const vars: EnvOf<typeof VAR_KEYS> = pickEnv(VAR_KEYS);

/** 机密（类型收窄到 SECRET_KEYS 声明集；仅在运行实例 env 中有值） */
export const secrets: EnvOf<typeof SECRET_KEYS> = pickEnv(SECRET_KEYS);

/** 部署上下文（平台注入的只读元数据） */
export const ctx = {
  /** 部署环境（M1 仅默认环境） */
  environment: (process.env.APPHOST_ENVIRONMENT ?? "development") as string,
  /** 所属应用 id（平台注入） */
  appId: process.env.APPHOST_APP_ID ?? "",
};
