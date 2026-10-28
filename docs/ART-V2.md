# 糖果辨识度调整 · v2

新图生成原稿保存于 `output/art/candy-atlas-v2.png`，优化稿现归档于 `output/art/retired-runtime/candy-atlas-v2.png`，当前运行使用[v3软萌手绘版](ART-V3.md)。由内置 GPT Image Tool 生成，原图作为材质风格参考；未使用 CLI fallback。

## 设计调整

保留晶莹糖衣、圆形碰撞外轮廓和厚实高光，减少细小气泡与干扰中心的反光。相近水果同时用外壳色、明暗和内部形状区分，尤其针对手机上的小图标：

- 樱桃：深酒红外壳、双果形状与亮绿 V 形果梗。
- 草莓：亮玫粉外壳、单颗三角形果身、几颗大号奶油色籽与明显叶冠。
- 葡萄：紫色外壳、五颗大葡萄。
- 柠檬 / 蜜橘：浅黄色 / 琥珀橙色外壳，粗白色切片分界。
- 苹果：青蓝色外壳包裹珊瑚红苹果，从红色糖果中明显分离。
- 青梨：亮青绿外壳、上窄下宽果形。
- 蜜桃：奶油桃色外壳、双瓣粉桃与中间凹缝。
- 菠萝：金黄外壳、粗菱格与短叶冠。
- 哈密瓜：薄荷色外壳、浅色半瓜与几颗深色瓜籽。
- 西瓜：深森林绿外壳、三角红瓜片、三颗大黑籽。

## 输出与只读检查

- 文件：`output/art/candy-atlas-v2.png`
- 尺寸：1448 × 1086。
- 原始大小：1,962,675 字节。
- RGBA alpha 范围0–255，左上角 alpha0，最后一格透明；不是烘焙棋盘格。
- 已查看完整图片，确认11种水果次序和外观。
- 以 alpha≥128 连通区域只读统计得到11个独立大区域；没有对图片做裁切、抠图、重绘或格式转换。
- 生成排列不是严格等分4×3，不能使用 `width/4`、`height/3` 直接切图。

## 裁切坐标

下表可见区域使用 alpha≥128 的包围盒；源矩形向四周留3像素保护边。生成圆有约2–3%的横向宽差，绘制时可以将源矩形归一化为正方形，使可见圆和物理圆一致。

若半径为 `r`，源矩形为 `sw×sh`，可见区域为 `vw×vh`，目标矩形建议：

```text
目标宽度 = 2 * r * sw / vw
目标高度 = 2 * r * sh / vh
目标中心 = 物理圆心
```

这会将可见区域映射到直径 `2r` 的圆。表中的源矩形均与相邻糖果保持分离，不应再外扩。

| 等级索引 | 水果 | 源矩形 `[x,y,w,h]` | 可见区域尺寸 `[vw,vh]` |
| --- | --- | --- | --- |
| 0 | 樱桃 | `[38,48,340,332]` | `[334,326]` |
| 1 | 草莓 | `[383,47,340,333]` | `[334,327]` |
| 2 | 葡萄 | `[725,47,340,332]` | `[334,326]` |
| 3 | 柠檬 | `[1071,48,342,332]` | `[336,326]` |
| 4 | 蜜橘 | `[37,381,340,332]` | `[334,326]` |
| 5 | 苹果 | `[382,381,341,332]` | `[335,326]` |
| 6 | 青梨 | `[725,381,341,332]` | `[335,326]` |
| 7 | 蜜桃 | `[1070,382,343,333]` | `[337,327]` |
| 8 | 菠萝 | `[37,713,340,332]` | `[334,326]` |
| 9 | 哈密瓜 | `[382,713,341,332]` | `[335,326]` |
| 10 | 西瓜 | `[725,713,341,331]` | `[335,325]` |

已在1280×640和844×390浏览器画面复核，新增 `src/art.ts` 按原始坐标等比采样，并将优化稿缩放为1024×768、保留透明通道。原始稿留在 `output/art`，不应与正式运行稿一起重复进入微信主包。

## 生成提示词（原文）

```text
Use case: stylized-concept. Asset type: production 2D fruit-candy game sprite atlas, transparent alpha. Use the supplied existing atlas ONLY as reference for its polished glossy translucent hard-candy material and premium hand-painted casual game art style. Redesign the icons for unmistakable recognition at tiny 30-pixel size. Create one wide 4:3 atlas with EXACTLY 4 columns × 3 rows of equal square cells, every candy perfectly centered in its own cell, all candy outer circles exactly the same diameter, about 76% of a cell, generous transparent gutters. Eleven perfectly round isolated tokens, final bottom-right cell empty. Row-major order is critical. Row 1: (1) CHERRY: deep DARK BURGUNDY / wine-purple circular shell and a pair of TWO enormous dark-red cherries joined by bold LIGHT GREEN V-shaped stems, simple distinctive pair silhouette; (2) STRAWBERRY: vivid HOT PINK circular shell, one huge unmistakably TRIANGULAR strawberry with 5 large CREAM seed dots and broad bright GREEN leaf cap, no cherries; (3) GRAPE: rich VIOLET shell, a simple cluster of five large PURPLE grape circles; (4) LEMON: PALE YELLOW shell, bold light-yellow citrus cut with five large WHITE radial segment boundaries. Row 2: (5) ORANGE: saturated AMBER ORANGE shell and one orange cut with six big orange segments; (6) APPLE: bright cool AQUA / TURQUOISE circular shell, one large CORAL RED apple with distinct apple-lobed silhouette, strong cream highlight and one green leaf; (7) PEAR: bright LIME GREEN shell, single oversized GREEN pear with narrow neck and broad base; (8) PEACH: soft PEACH CREAM circular shell, oversized pink peach with two lobes and a strong central cleft. Row 3: (9) PINEAPPLE: GOLD shell with a single large yellow pineapple, bold big diamond lattice and short green crown; (10) MELON: pale MINT shell containing a cream green half melon with a few large dark seeds, no orange or red; (11) WATERMELON: DARK FOREST GREEN shell/rind around a huge clearly TRIANGULAR RED watermelon slice with three large BLACK seeds and white-green rind; (12) EMPTY transparent. Preserve appealing jewel candy thickness with a controlled creamy specular ring and just one small upper-left highlight. REDUCE excessive tiny bubbles, glitter and fine reflections so centers stay clear. Candy circle must remain round; no fruit or leaf protrudes beyond circular silhouette. Different shells must remain visibly distinct in grayscale/value as well as hue: dark cherry, medium pink strawberry, medium-dark purple grape, light lemon, warm orange, cool aqua apple. Transparent background is required, no checkerboard baked in, no black/white background. NO text, labels, numbers, grid lines, frames, letters, extra fruit, drop shadows outside circles, mascots or UI. All icons equal circle size and front view; no background art.
```
