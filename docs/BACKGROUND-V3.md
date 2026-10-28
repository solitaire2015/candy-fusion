# 更软萌的背景 · v3

本稿使用内置 GPT Image Tool（imagegen 技能的 built-in 模式）生成，未使用 CLI/API fallback。三张新截图仅用于构图氛围、配色和二维手绘风格参考，没有将截图中的贴图、角色、文字或 UI 裁切进正式素材。

## 生成输出

- 原稿：`output/art/candy-world-v3.png`
- 尺寸：1774 × 887，精确2:1。
- 文件大小：1,497,443字节。
- 用途：横屏糖果游戏的整幅背景；瓶子、水果和按钮继续由游戏单独叠加。
- 原始生成文件留存于 Codex generated_images；项目内副本已保存，运行不依赖该缓存目录。

## 设计与检查

背景采用更简化的二维粉紫手绘风格：奶油边棉花糖云、淡紫糖霜山丘、圆润草莓奶色前景，少量棒棒糖与糖晶仅分布在底部两角。中间和左右信息区保留了大面积安静天空，便于看清瓶内水果和面板。

已用图像查看工具检查输出，无文字、数字、UI、品牌水印、角色、瓶子或悬浮水果。画面没有沿用上一版的写实深景、河流或强金属感。未对原稿做裁切或重绘；正式JPEG压缩与运行接入由主代理执行。

## 参考文件

- `docs/references/微信图片_20261027213009_30330_36.jpg`
- `docs/references/微信图片_20261027213046_30331_36.jpg`
- `docs/references/微信图片_20261027213047_30332_36.jpg`

## 完整生成提示词

```text
Use case: illustration-story. Asset type: original wide 2D mobile fruit-candy game background, horizontal 2:1 aspect ratio. The three input screenshots are STYLE REFERENCES ONLY: take inspiration from their gently painted flat candy landscape, periwinkle lavender sky, simplified lavender mountains, pink rolling hills and creamy rounded clouds. Generate a completely original environment, with NO interface or game objects. Soft cute Korean/Japanese casual-game illustration, delicate pastel periwinkle-to-lavender sky with rounded cotton-candy clouds at upper outer corners, simplified lavender mountains with sparse tiny sprinkle-like snow dots across the distant lower horizon, two large gentle curves of strawberry-milk pink hills in foreground. Small stylized sugar crystals and one little softly shaded lollipop tucked into each far bottom corner only. Calm clean center 65% and calm left/right panel zones, enough contrast for colorful translucent fruit candies and a transparent jar drawn separately in the game. Shapes feel puffy, friendly, round and softly painted, with simple 2D shading and creamy edge highlights, a few tiny twinkles. Keep the background readable and spacious, not busy. Pastel pink, lilac, periwinkle and creamy vanilla with subtle mint accents. Avoid realistic texture, photorealistic clouds, dramatic cinematic lighting, deep vista, rivers, complex buildings, metallic jewels, glass balls, hard neon highlights and glossy 3D gemstones. No characters, no faces, no people, no animals, no jar/bottle, no fruits floating in the sky, no UI, no panels, no buttons, no text, no letters, no numbers, no logos, no watermark. Do not reproduce exact screenshot art or any existing character.
```
