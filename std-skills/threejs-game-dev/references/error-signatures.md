# 错误签名对照表（error-signatures）

> `签名 → 根因 → 修复动作`。全部实测采集（逆向分析 + transport-ship-3d 验收教训）；
> 新签名修复成功后按三段追加，同类出现 ≥2 次考虑给 preflight 加机判。

---

## E-01 走 EffectComposer 后画面发灰发暗

- **签名**：接了 composer 后整体像蒙了层灰；直接 `renderer.render()` 反而正常。
- **根因**：three r155+ 色彩管理重写，toneMapping 与 sRGB 输出移到 `OutputPass`；
  composer 链尾没有它，颜色空间就停在线性。
- **修复**：链尾补 `composer.addPass(new OutputPass())`；每帧用 `composer.render()`；
  resize 时 composer 与 renderer 都要 setSize。

## E-02 页面离线/内网白屏，控制台一片 import 失败

- **签名**：`importmap` + CDN（unpkg/jsdelivr）地址；换个环境白屏。
- **根因**：把运行时依赖寄托在外网 CDN，违背「单文件零外链」契约。
- **修复**：three 从 npm 安装（精确钉版），esbuild 全量内联进单 HTML；
  preflight P7 / singlefile.contract 机判产物零外链。

## E-03 新检出机器 `npm run build` 直接失败

- **签名**：`tsc: command not found` / `ERR_MODULE_NOT_FOUND: esbuild`（transport-ship-3d 验收 A 的真实翻车）。
- **根因**：构建关键依赖没写进 `devDependencies`（靠全局残留或 npx 浮动解析），或版本带 `^` 导致新环境解析到不兼容新版。
- **修复**：`three`/`esbuild` 精确钉版写入 devDependencies + 提交 `package-lock.json`；
  README 写明 `npm install && npm run build` 全流程；verify-reproducible 双构建哈希比对常驻门禁。

## E-04 移动端触摸时灵时不灵 / 点击延迟 300ms / 双击页面缩放

- **签名**：桌面正常，手机上拖动断续、双击缩放页面、长按弹出菜单。
- **根因**：浏览器手势（滚动/双击缩放/长按）与触摸事件冲突；`click` 事件自带 300ms 延迟。
- **修复**：`html/body/#gl` 全部 `touch-action:none` + `overscroll-behavior:none` +
  viewport `maximum-scale=1`；交互用 `touchstart` 直响应，禁走 click；控件热区 ≥ 44px。

## E-05 同 seed 两次跑结果不同 / 测试偶发失败

- **签名**：内核确定性断言随机挂；重现不了 bug。
- **根因**：系统随机（`Math.random`）或系统时钟（`Date.now`/`performance.now`）混进了内核。
- **修复**：内核唯一随机源 = 注入的 mulberry32（`src/kernel/rng.js`）；时间只以 dt 参数进内核；
  preflight P3 机判内核文件禁入上述符号。

## E-06 掉帧时游戏变慢 / 切后台回来角色瞬移

- **签名**：低配设备上子弹飞得慢；浏览器切走 10 秒回来直接被击杀。
- **根因**：把渲染 dt 直接当物理步长（变步长积分），长 dt 一帧跳过整个碰撞窗口。
- **修复**：固定步长累加器（`FIXED_STEP=1/60`）+ `dt = clamp(dt, 0, MAX_DT)`；
  表现层插值可后加，内核永远步进。

## E-07 手机上没声音，控制台 AudioContext 警告

- **签名**：`The AudioContext was not allowed to start`；一切音效无声。
- **根因**：AudioContext 在用户手势前创建，被浏览器自动挂起。
- **修复**：首次手势（开始按钮 touchstart/click）里创建/resume；headless 环境整个 no-op 不抛错。

## E-08 手机发烫掉帧 / 渲染分辨率比屏幕还高

- **签名**：3x 屏手机上帧率崩、机身热。
- **根因**：`setPixelRatio(devicePixelRatio)` 无上限，渲染像素数随 dpr 平方增长。
- **修复**：`setPixelRatio(Math.min(devicePixelRatio, 2))`；低帧场景再降 bloom 分辨率。

## E-09 极端输入把内核打成 NaN，之后全屏行为失控

- **签名**：注入 `1e9` 位移或 NaN intent 后，角色消失、碰撞永不触发、测试冻结。
- **根因**：内核入口不设防，非有限值污染世界状态并自我繁殖。
- **修复**：内核入口统一 `finiteOr`（非有限回退默认）+ 范围钳制；
  边界对抗断言常驻（极端 intent/超界坐标/0 与负值 dt），见模板 `tests/state-machine.spec.mjs`。

## E-10 暂停连按/结算瞬间继续输入产生幽灵状态

- **签名**：连按暂停后恢复不了；结算帧还能开火；重开后血量/弹药是旧值。
- **根因**：状态转移无守卫、重开只改部分字段。
- **修复**：状态机放内核、转移全有守卫（非法 no-op + warning）；restart = 整个 world 重建；
  边界用例常驻：暂停连按 ≥5、结算瞬间输入、重开连点 ≥5、playing 中途重开全复位。
