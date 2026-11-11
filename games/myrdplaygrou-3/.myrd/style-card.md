# style-card: football-flat-bright

- scope: myrdplaygrou-3（实况足球 · GOAL RUSH）
- applies-to: global（palette / character / ui / tileset / sfx 全品类锚点）
- palette-anchor: 用户拍板「扁平明快」，三主色 **#3498db / #2ecc71 / #f39c12** —— 全工程唯一色值来源
  （代码侧 `src/render/textures.js PALETTE`、HUD 侧 CSS 变量同源，禁止第二处色值）

## 定义

### palette（配色）
- 主色（主队/交互主色）: #3498db（蓝，主队队服 + 玩家指示环）
- 场地色（大面积底）: #2ecc71（草绿，球场 + 中圈 + 标线底）
- 强调色（客队/警示/按钮）: #f39c12（橙，客队队服 + 射门按钮 + 受控球员标记）
- 辅助中性色: 白 #ffffff（标线/边网/号码）、深蓝黑 #1b2a38（夜空底/边界板）、灯光青 #7fdfff（点缀光）
- 饱和度倾向: 高饱和、扁平直给（无渐变堆叠；材质 roughness 0.4-0.85 哑光为基调）
- 明度范围: 场地中高明度（草绿 L≈62%），HUD 面板低明度半透明（rgba(8,16,20,.62)）—— 画面主体亮、界面沉

### character（球员 · 程序化关节人形）
- 头身比: 约 1:3.2（头略大的明快卡通比例；头 r=0.17m / 全身高≈1.75m）
- 线条: 无描边；形体靠色块分面（队服/短裤/球袜/球鞋四段色）
- 形状语言: 圆润为主 —— 头/关节球面圆润，四肢为圆角长方段（BoxGeometry 细分段），禁尖刺棱角
- 分段: 上臂/前臂、大腿/小腿各两段（肩/肘/髋/膝四个可见关节），跑动相位动画（kernel phase 驱动）
- 队服色 + 号码: 主队 #3498db / 客队 #f39c12 / 双方门将 #2ecc71 深变体；背部号码白字 canvas 贴图（1-11）
- 比例参考: Q 版微缩 —— 肩宽 ≈ 头宽×1.6，腿长 ≈ 身高 45%

### ui（界面）
- 圆角半径: 12px（面板/按钮全局一致）
- 描边: 1px rgba(127,223,255,.55) 细边框，无投影（扁平）；按下态亮度 -10%
- 字体层级: 比分 26px tabular / 标题 30px 加宽字距 / 正文 14px；数字用等宽变体防跳动
- 按钮热区: ≥ 56px（触屏优先；射门钮 ≥ 88px）
- 色彩: 面板底 = palette 深色半透明；强调 = #f39c12（射门）/ #3498db（传球）

### tileset（球场）
- 透视: 3D 俯视后上方跟随镜头（竖屏长轴 = 进攻方向 -Z）
- 标线: 纯白 6px 等宽（中圈/禁区/中线），同一 canvas 贴图绘制 —— 禁两条粗细不一的线
- 接缝规则: 草纹以 8px 深浅条带平铺（RepeatWrapping），禁止随机噪点污渍

### sfx / music
- 波形: 音效 = square/triangle 短包络（哨声 square 双颤音、踢球 low sine 冲击、进球上行琶音+噪声欢呼）
- BGM: 128 BPM 四小节循环（bass 方波 + 三和弦琶音），响度基准 -14 LUFS 量级（总线 DynamicsCompressor 收口）
- 混响量: 0（程序化合成不挂卷积混响）；全场氛围 = 低通白噪声「人声海」恒低增益

## 生成提示词模板

flat bright 3D casual football, pure color blocks no gradients, team jersey #3498db vs #f39c12
on grass green #2ecc71 pitch, rounded chunky low-poly humanoid, white pitch lines 6px,
clean mobile portrait composition, {subject}, cohesive with football-flat-bright style card

## 反例（禁止）

- 写实纹理/照片级草皮、金属反光球衣（与扁平明快基调冲突）
- 画面出现三主色以外的第四种高饱和色（点缀青 #7fdfff 仅作灯光，不作大面色块）
- 拟物渐变 + 大投影 UI；同一屏两种圆角半径；描边粗细不一
- 球员无关节分段（一坨胶囊体 = 违反本卡 character 分段维度）
- 号码缺失或两队同色（主队蓝/客队橙/门将绿 三方必须可一眼区分）
