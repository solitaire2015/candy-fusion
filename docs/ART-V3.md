# 软萌手绘水果糖 · v3

使用内置 GPT Image Tool（built-in 模式）生成，未使用 CLI/API fallback。用户新增的三张早期游戏截图作为材质、造型和氛围参考，正式资产为重新生成的原创画面；参考里的角色、文字、界面与水印没有进入素材。

## 视觉方向

将 v2 的高饱和宝石糖衣调整为柔和的手绘水果糖：奶油色高光边、淡色半透明糖衣、少量宽软笔触反光、圆润的水果图案和轻微糖片厚度。保留无表情的水果形象，让可爱感来自比例、配色和材质。

小图标继续用形状与色系区分：双樱桃、带大籽的尖形草莓、五颗葡萄、柠檬切片；蜜橘改为整果与小叶，避免与柠檬切片重复；苹果、青梨、蜜桃、菠萝、哈密瓜和西瓜保留明显轮廓。新版背景为更接近参考的二维粉紫雪山、棉花糖云和圆润糖果丘陵，见 [背景记录](BACKGROUND-V3.md)。

## 文件与检查

- 原始图集：`output/art/candy-atlas-v3.png`，1448×1086，RGBA，有真实透明通道（范围0–255，角点0）。
- 正式图集：`public/assets/candy-atlas-v3.png`，等比缩小为1024×768，保留透明通道。
- 正式背景：`public/assets/candy-world-v3.jpg`，1774×887；原稿在`output/art/candy-world-v3.png`。
- 精确裁切：`src/art.ts`，按原始坐标等比采样并将可见外缘映射到物理半径。独立 alpha≥128 大连通区域共11个。
- 桌面与手机比例实际运行图：`docs/screenshots/gameplay-v3.png`、`docs/screenshots/phone-layout-v3.png`。
- v2原始稿及发行稿保留于`output/art`、`output/art/retired-runtime`，发行包只含v3。

已检查1280×640和844×390浏览器效果、图片请求200、正确显示水果顺序；17项规则/平台/音频测试与双平台构建通过。微信主包约1.82MiB。玩法、5%尺寸系数、悬空修复与音频保持现有版本。

## 图集源坐标

源矩形在可见 alpha 包围盒外保留3px。目标宽高分别取`2r * 源宽 / 可见宽`、`2r * 源高 / 可见高`，保持圆形碰撞轮廓。

| 索引 | 水果 | 源矩形[x,y,w,h] | 可见尺寸[w,h] |
| --- | --- | --- | --- |
| 0 | 樱桃 | [35,32,339,337] | [333,331] |
| 1 | 草莓 | [383,32,338,336] | [332,330] |
| 2 | 葡萄 | [730,32,338,336] | [332,330] |
| 3 | 柠檬 | [1077,32,340,338] | [334,332] |
| 4 | 蜜橘 | [35,372,340,333] | [334,327] |
| 5 | 苹果 | [383,372,342,334] | [336,328] |
| 6 | 青梨 | [731,372,340,335] | [334,329] |
| 7 | 蜜桃 | [1076,371,346,337] | [340,331] |
| 8 | 菠萝 | [34,707,342,337] | [336,331] |
| 9 | 哈密瓜 | [383,708,341,336] | [335,330] |
| 10 | 西瓜 | [725,708,340,336] | [334,330] |

## 完整生成提示词

```text
Use case: stylized-concept. Asset type: original production 2D fruit candy sprite atlas for a cute landscape mobile merge game. The three supplied screenshots are STYLE REFERENCES ONLY: study the softly painted fruit pictures sealed inside translucent pale sugar discs, warm creamy rims, gentle hand-painted mobile-game charm. DO NOT copy any UI, names, text, branding, watermark, or characters. Generate ONLY eleven ORIGINAL circular fruit candy sprites on a genuinely TRANSPARENT alpha background. A precisely spaced 4-column by 3-row rectangular atlas (4:3 composition), one identical-sized face-on circle in each square cell, transparent generous gutters all around, final bottom-right cell EMPTY. All fruit illustrations fully inside the circular candy. Style: sweet soft pastel hand-painted 2D candy illustration, simple bold rounded fruit silhouettes, slight candy-disc depth via a subtle painted side edge, thick luminous creamy translucent rim, broad soft white brush highlight upper-left, softly washed colored transparent sugar, just one or two subtle glints. Friendly rounded toy-like proportions and generous negative space around fruit center. Softer and cuter than a realistic shiny fruit or gemstone. No hard metallic gloss, no neon, no photorealism, no 3D spheres, no excessive specular rings. Maintain tiny 30px readability through distinct hues/value and clear oversized center symbols. NO faces or eyes. ROW-MAJOR ORDER: row1 (1) CHERRY: muted raspberry/burgundy-pink sugar disc, TWO plump rounded rose-red cherries joined by a simple curved leaf-green V stem, dark enough to distinguish from the strawberry. (2) STRAWBERRY: peach-coral sugar disc, ONE oversized clearly TRIANGULAR light strawberry-red fruit with just five large cream seed dots and a little rounded mint-green leaf crown; visibly different from cherry pair. (3) GRAPE: soft plum/lilac candy disc, a cluster of five plump lavender-purple grape circles with one tiny leaf. (4) LEMON: pale buttery-yellow disc, a round yellow citrus slice with five broad cream radial dividers and no green leaf. row2 (5) MANDARIN: warm apricot-orange candy disc with one plump whole tangerine and tiny rounded green leaf at top, no yellow citrus segment pattern. (6) APPLE: pale vanilla-cream/pale coral shell around one rounded coral-red APPLE with obvious two-lobed top and tiny green leaf, soft simple drawn highlights; distinct from small berry levels. (7) PEAR: pale spring-green disc, one large sage/lime-green pear with a short stem, rounded broad bottom and narrow neck. (8) PEACH: pale blush-cream disc, a pair of joined pastel pink peach lobes and a clear soft curved center seam, little mint leaf, especially cuddly rounded drawing. row3 (9) PINEAPPLE: pale vanilla/golden-cream disc, a chubby butter-yellow pineapple with simplified wide diagonal lattice and short soft mint crown. (10) MELON: pale mint-green disc, a round pale honeydew half with softly painted net-pattern rind and a few large cream seeds, clearly different from pear. (11) WATERMELON: soft mint/grass-green disc, an oversized pink-red watermelon wedge with cream-white and green rind and three large brown-black seeds. (12) EMPTY transparent. Keep every circle same diameter and front-on, including watermelon and pineapple. Entire image transparent outside individual discs, no background, no checkerboard baked in, no labels or numbers, no text, no gridlines, no exterior drop shadows, no surrounding particles. Clean separations between sprites are essential. Use reference only to guide material and illustration softness, not to reproduce exact assets.
```
