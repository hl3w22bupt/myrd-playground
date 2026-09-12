/**
 * 平台注入物声明 —— key 白名单的事实源（repo 即事实源，对齐 EdgeSpark）。
 *
 * 约定：
 *   - 只有在这里 `as const` 声明过的 key，代码才能通过 #apphost 的 vars/secrets 读取；
 *     用错/拼错 key 会在 `tsc --noEmit`（部署管线步骤 2）直接失败。
 *   - secret 的「值」由人在 MyRD dashboard / API 填入（人机分离），agent 只注册 key 名。
 *   - 修改本文件后重新部署生效。
 *
 * 本应用是纯静态伺服的游戏壳，无需任何 vars/secrets，保持空集即可。
 */

/** 明文环境变量（非敏感）：运行时注入 process.env */
export const VAR_KEYS = [] as const;

/** 机密（敏感）：agent 注册 key 名，人填值，AES-GCM 加密落库，API 永不回读 */
export const SECRET_KEYS = [] as const;
