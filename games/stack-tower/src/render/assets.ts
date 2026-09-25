/**
 * 资产清单与加载（T3 美术线 assets/ 实体接线层）。
 * 纪律：
 *  - 文件名与 spec lvl-01-stack-tower 元素 id 逐字对应（e01–e08）+ tileset/ui 分类；
 *  - 三态：无加载器（headless/Node 契约测试）→ 空 → 程序化绘制；
 *          加载失败（404/解码失败）→ 该项为 null → 同样回程序化，绝不抛错、不破坏运行；
 *  - 零外部资源：全部相对路径（同源 serve），禁止 http(s) 外链（黑板 assets.md 红线）。
 */

export type GameImage = HTMLImageElement;
/** 平台注入的图片加载器（浏览器 = Image + onload/onerror；headless = 不注入） */
export type ImageLoader = (url: string) => Promise<GameImage | null>;

/** 资产清单：key = 接线点名，value = 工程内相对路径（文件名含 spec 元素 id） */
export const ASSET_MANIFEST = {
  /** e01-spawn-first-block：塔基块贴图 */
  blockBase: 'assets/sprites/e01-spawn-first-block.png',
  /** e02-swing-motion：摆动块贴图（下缘反弹光已烘焙） */
  blockMove: 'assets/sprites/e02-swing-motion.png',
  /** e03-drop-input：落点参考虚线（构图脚本 L4 引导层） */
  guide: 'assets/sprites/e03-drop-input.png',
  /** e04-overlap-cut：切面错口碎块 */
  debris: 'assets/sprites/e04-overlap-cut.png',
  /** e05-perfect-window：完美切面脉冲框（风格卡 §1 特殊时刻光） */
  perfectPulse: 'assets/sprites/e05-perfect-window.png',
  /** e06-tower-ripple：塔身涟漪环贴图 */
  rippleRing: 'assets/sprites/e06-tower-ripple.png',
  /** e07-score-hud：HUD 顶部 56px 安全区渐隐衬底（L5，无底板） */
  hudScrim: 'assets/ui/e07-score-hud.png',
  /** e08-fail-recover：重开入口按钮皮肤（HUD DOM） */
  restartButton: 'assets/ui/e08-fail-recover.png',
  /** 塔块三循环 tileset（陶土橙/砖红/沙黄，层序读数） */
  blockTileset: 'assets/tileset/blocks-tower.png',
} as const satisfies Record<string, string>;

export type AssetKey = keyof typeof ASSET_MANIFEST;
/** 加载结果：缺项 = null（回退程序化） */
export type GameAssets = Partial<Record<AssetKey, GameImage>>;

export function emptyAssets(): GameAssets {
  return {};
}

/**
 * 并行加载全部清单项；单项失败静默降级为 null。
 * 无加载器（Node/无头契约测试）直接返回空清单 —— 引用失败不得破坏运行。
 */
export async function loadGameAssets(loadImage?: ImageLoader, log?: (msg: string) => void): Promise<GameAssets> {
  if (!loadImage) return emptyAssets();
  const entries = Object.entries(ASSET_MANIFEST) as [AssetKey, string][];
  const loaded = await Promise.all(
    entries.map(async ([key, url]) => {
      try {
        return [key, await loadImage(url)] as const;
      } catch {
        return [key, null] as const;
      }
    }),
  );
  const out: GameAssets = {};
  let ok = 0;
  for (const [key, img] of loaded) {
    if (img) {
      out[key] = img;
      ok++;
    }
  }
  log?.(`[assets] 贴图就绪 ${ok}/${entries.length}${ok < entries.length ? '（缺项走程序化 fallback）' : ''}`);
  return out;
}
