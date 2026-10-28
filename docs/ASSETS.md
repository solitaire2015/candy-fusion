# 原创游戏素材

本项目的正式背景与糖果图集使用内置 GPT Image Tool（imagegen 技能的 built-in 模式）生成，未使用 CLI/API fallback。参考录像及截图只用于沟通玩法与视觉方向，没有裁取到正式游戏素材中。

## 当前正式素材（v3）

- `public/assets/candy-world-v3.jpg`：粉紫二维雪山、圆润糖果丘陵与奶油云背景，1774×887；原稿为`output/art/candy-world-v3.png`。
- `public/assets/candy-atlas-v3.png`：软萌手绘水果糖图集，1448×1086生成原稿优化为1024×768、保留透明通道。原稿在`output/art/candy-atlas-v3.png`，按精确包围盒采样，见`src/art.ts`与[v3设计记录](ART-V3.md)。
- `public/assets/audio/`：三个短音效与32秒纯音乐，通过StarT MCP调用fal上的ElevenLabs生成，提示词和稳定资产ID见[音频记录](AUDIO.md)。

v3以用户新增的早期截图为风格参考，保留奶油高光、透明糖衣与简单圆润的水果图案；旧v2的辨识度设计记录见[ART-V2](ART-V2.md)，旧发行稿保留在`output/art/retired-runtime`。背景转码与图集缩放仅做发行优化，原始生成文件保留，不把原稿与发行稿重复打包。玩法与物理半径系数本轮不变。

## 首版原稿归档（以下坐标属于 v1）

- `output/art/candy-world-original.png`：1774 × 887，2:1 横屏背景。绘制时铺满逻辑画布，操作区与透明瓶子由代码叠加。
- `output/art/candy-atlas-v1.png`：1448 × 1086，透明水果糖果图集，视觉上 4 列 × 3 行，按行读取，共 11 个圆形糖果，最后一格留空。已检查 PNG 具有真实 alpha，透明角点为 0，alpha 范围为 0–255。

等级索引从 0 开始：樱桃、草莓、葡萄、柠檬、橙子、苹果、梨、桃子、菠萝、蜜瓜、西瓜。糖果直径由玩法配置决定，不以图集单元格大小决定。

正式发布需要保持图片 alpha 通道；参考视频与截图不得复制到游戏发行包。图集的圆形外缘和透明留白需要在渲染时与物理半径匹配。

## 图集裁切

生成图的视觉行列没有严格落在等分网格上，不能简单用 `width / 4` 与 `height / 3` 裁切。下面是已根据 alpha 连通区域核对的源矩形；每格为 328 × 328，主要圆形的直径约 316 像素。若物理半径为 `r`，可将源矩形绘制到直径 `2 * r * 328 / 316` 的目标区域，使圆形实心轮廓接近物理轮廓。实际裁切仍保留少量透明抗锯齿边。

| 索引 | 水果 | 源矩形 `[x, y, width, height]` |
| --- | --- | --- |
| 0 | 樱桃 | `[37, 48, 328, 328]` |
| 1 | 草莓 | `[387, 48, 328, 328]` |
| 2 | 葡萄 | `[735, 48, 328, 328]` |
| 3 | 柠檬 | `[1082, 48, 328, 328]` |
| 4 | 橙子 | `[37, 377, 328, 328]` |
| 5 | 苹果 | `[387, 377, 328, 328]` |
| 6 | 梨 | `[735, 377, 328, 328]` |
| 7 | 桃子 | `[1082, 377, 328, 328]` |
| 8 | 菠萝 | `[37, 705, 328, 328]` |
| 9 | 蜜瓜 | `[387, 705, 328, 328]` |
| 10 | 西瓜 | `[735, 705, 328, 328]` |

已以图像查看工具检查背景构图、糖果次序、透明背景和独立轮廓，并用只读像素分析复核糖果 alpha 连通区域。没有对生成图做裁切、抠图或重绘。两个原始 PNG 合计约 3.7 MiB，发行构建仍需结合代码体积评估包体和资源分包。

## 背景生成提示词（原文）

```text
Use case: illustration-story. Asset type: polished original 2D casual mobile game environment background, wide landscape image about 2:1. A dreamy fruit candy world in pastel lavender, blush pink and creamy warm yellow. Distant lavender mountains and soft fluffy rose clouds in a luminous purple sky, a few tiny star sparkles. Layered soft pink candy hills in foreground and oversized glossy translucent candy pebbles and one swirled lollipop tucked in each far lower corner. Rich painterly digital game illustration with smooth airbrushed gradients, clear silhouettes and luminous glossy highlights. Center 65% of the frame should be calm spacious mostly sky and distant hills to support a transparent gameplay jar and UI drawn on top later. Composition cheerful and magical, refined hand-painted casual game art, enough saturation at corners but quiet center. NO UI, NO panels, NO text, NO letters, NO logos, NO characters, NO jar, NO border. Original design; do not reproduce any existing game assets.
```

## 糖果图集生成提示词（原文）

```text
Use case: stylized-concept. Asset type: production 2D mobile game sprite atlas on a GENUINELY TRANSPARENT BACKGROUND with alpha channel. One single image with exactly 4 columns and 3 rows of equal square cells, row-major order; one isolated perfectly round fruit hard candy token centered in each cell, consistent diameter about 76% cell width, generous equal transparent gutters, no overlap, final bottom-right cell entirely empty transparent. 11 tokens in order: row1 CHERRY, STRAWBERRY, GRAPE, LEMON; row2 ORANGE, APPLE, PEAR, PEACH; row3 PINEAPPLE, GREEN MELON, WATERMELON, EMPTY. Every token has the same perfect round circular outer silhouette and same face-on camera. Thick translucent glossy jewel-colored hard sugar shell with a bright creamy specular ring around the edge, small white upper-left highlight, soft golden inner rim, fruit illustration sealed INSIDE the candy. Fruit shapes must NOT protrude beyond the round candy silhouette. Each center fruit is clearly readable at small game sprite size; fruit colors distinct: cherry deep pink, strawberry red, grape purple, lemon pale yellow, orange amber, apple coral red, pear lime green, peach warm blush, pineapple gold, melon mint green, watermelon red pink with dark green rim. Polished luminous painted casual game illustration, rich glassy highlights, crisp clean edges. No external shadow, no surrounding sparkle, no labels, no typography, no grid lines, no background of any color, no UI. Exact regular equal 4×3 grid alignment is critical for slicing in game code.
```
