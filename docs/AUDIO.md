# 音效、背景音乐与手机播放

本轮使用 StarT MCP 的生成与资产读取工具，实际路由为 **fal → ElevenLabs**，没有在游戏中使用在线生成服务或放入 API Key。音频全部作为本地 MP3 随包发行。

## 发行文件

| 文件 | 模型 | 实际时长 | 用途 |
| --- | --- | --- | --- |
| `public/assets/audio/drop.mp3` | ElevenLabs Sound Effects v2 | 0.48秒 | 软弹、短促的糖果投放声 |
| `public/assets/audio/merge.mp3` | ElevenLabs Sound Effects v2 | 0.88秒 | 上扬的钟琴与糖果闪光 |
| `public/assets/audio/over.mp3` | ElevenLabs Sound Effects v2 | 1.36秒 | 温柔的下降式结算音 |
| `public/assets/audio/music.mp3` | ElevenLabs Music | 32.078秒 | 轻快木琴、拨弦与轻打击纯音乐 |

默认音效音量0.6，音乐0.16，顶部各有独立开关。音乐使用循环播放；模型音频的收尾自然衰减，不宣称是样本级无缝循环。首次点击/按键后解锁播放，暂停和切后台停止音乐，用户继续对局后恢复。原始返回音频和完整请求归档在 `output/audio/`，不重复进入主包。

## 手机无声处理

旧实现没有明确覆盖微信默认静音行为，且音效在首次点击时才创建并立即 stop/play。本轮改为：

- 通过全局 `wx.setInnerAudioOption({obeyMuteSwitch:false,mixWithOther:true})` 配置；实例保留兼容属性。
- 使用与该选项兼容的原生驱动 `useWebAudioImplement:false`，预加载MP3，在canplay后播放。
- 短音效使用播放池（投放2、合成3、结算1），不立刻停止同一实例再重播。首次加载可短暂排队，过时反馈丢弃。
- 浏览器用Web Audio解码相同音频，可重叠播放；真正的用户交互后resume上下文。
- 页面/小游戏隐藏时清理待播放请求，停止音效和音乐；独立开关与释放资源均有测试。

这些是针对可确认代码路径的修复，手机硬件出声仍需用户扫码确认。微信开发者工具3.17.4基础库明确提示静音开关配置不能在工具里调试。

## 验证

15项测试与双平台构建通过，包含五项音频测试及真实打包入口的无DOM冒烟检查。浏览器观察到真实音效和32秒音乐解码播放、开关和暂停恢复正常；FFprobe确认四个MP3可读、非空；音乐源峰值约-1.2dB，未在生成源中检测到削波。Media Understand对投放/合成音效的描述为起音及时、清晰短促，对音乐判断为无歌声的轻快器乐。该工具分析是辅助检查，不代替手机试听。

## 稳定资产与完整生成请求

### drop

Provider: `fal`；模型：`fal-ai/elevenlabs/sound-effects/v2`；稳定资产ID：`2b1a44ad-3614-4a1f-a142-bc920c6512af`。

```json
{
  "text": "One single adorable soft jelly candy plop for a cute pastel mobile puzzle game: rounded bubbly 'bloop', lightly springy and tactile, tiny woody pop, a very short sweet upward pitch curl. Immediate attack, quick clean decay. Dry close-up isolated one-shot, no voice, no music, no ambience, no harsh high frequencies.",
  "duration_seconds": 0.5,
  "prompt_influence": 0.65,
  "output_format": "mp3_44100_128"
}
```

### merge

Provider: `fal`；模型：`fal-ai/elevenlabs/sound-effects/v2`；稳定资产ID：`492ba7d2-d2cb-4514-81d9-ede7c6de4723`。

```json
{
  "text": "One adorable candy fusion success sound for a pastel fruit puzzle game: two soft jelly bubbles pop together followed instantly by three tiny ascending marimba and glass-bell notes, a delicate magical sugar sparkle tail. Satisfying warm cute and clean. Short isolated one-shot, immediate attack, no voice, no melody bed, no ambience, no harsh high hiss.",
  "duration_seconds": 0.9,
  "prompt_influence": 0.65,
  "output_format": "mp3_44100_128"
}
```

### over

Provider: `fal`；模型：`fal-ai/elevenlabs/sound-effects/v2`；稳定资产ID：`c585fe9c-dc8a-40ff-bb75-84c7d51991ce`。

```json
{
  "text": "A very short gentle friendly 'oops' game-over jingle for an adorable candy game. Three descending round toy-piano notes with a soft cartoon bubble wobble and one tiny comforting glockenspiel sparkle. Sweet and playful, never alarming or sad, no voice, no laughter, no ambience, no loud crash. Isolated one-shot with clean ending.",
  "duration_seconds": 1.4,
  "prompt_influence": 0.65,
  "output_format": "mp3_44100_128"
}
```

### music

Provider: `fal`；模型：`fal-ai/elevenlabs/music`；稳定资产ID：`1f4674e7-5b19-4d26-9796-76dc92ae53fb`。

```json
{
  "prompt": "Original instrumental background loop for a polished cute pastel fruit candy puzzle game. Light whimsical cozy toy-box music, soft marimba, rounded toy piano, gentle pizzicato strings, occasional delicate glockenspiel sugar sparkles, warm simple bass and very soft shaker. 120 BPM, C major, light swinging feel. A memorable but unobtrusive four-bar motif developed over exactly sixteen bars, 32 seconds. Soft friendly playful magic, leaves space for candy popping sound effects. Continuous steady game loop, same instrumentation and harmony at beginning and end, end leads naturally back to first beat. No intro, no outro, no fade, no dramatic climax, no vocals or speech, no harsh chiptune beeps, no heavy drums, no existing song quotation.",
  "music_length_ms": 32000,
  "force_instrumental": true,
  "output_format": "mp3_44100_128"
}
```

官方模型接口参考：[ElevenLabs Sound Effects on fal](https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2/api)、[ElevenLabs Music on fal](https://fal.ai/models/fal-ai/elevenlabs/music/api)。
