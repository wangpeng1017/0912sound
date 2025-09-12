# 老师喊我去上学 - 音色克隆 TTS 应用

一款极简的移动端音色克隆应用，通过文字生成指定音色的语音。用户可以输入文本，现场录制一段声音作为音色样本，然后生成一段由该声音说出指定文本的音频。

## 🌟 功能特性

- 🎙️ **实时录音**: 使用设备麦克风录制音色样本（推荐 10-15 秒）
- 🤖 **AI 音色克隆**: 基于 Hugging Face TTS 模型生成克隆语音
- 🎵 **音频播放**: 内置播放器支持播放、暂停、进度控制
- 📱 **响应式设计**: 适配移动端和桌面端浏览器
- 💾 **音频下载**: 支持下载生成的音频文件
- 🔒 **隐私保护**: 不在服务器存储用户录音或文本

## 🚀 技术栈

- **前端框架**: Next.js 15 + React 18
- **样式**: Tailwind CSS
- **语言**: TypeScript
- **音频处理**: Web Audio API + MediaRecorder API
- **TTS 服务**: Hugging Face F5-TTS
- **部署**: Vercel

## 🛠️ 本地开发

1. 克隆项目
```bash
git clone https://github.com/wangpeng1017/0912sound.git
cd 0912sound
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.local.example .env.local
```
在 `.env.local` 中配置你的 Hugging Face Token：
```
NEXT_PUBLIC_HF_SPACE_URL=https://huggingface.co/spaces/wangpe/2E2-F5-TTS
NEXT_PUBLIC_HF_API_NAME=/predict
HF_TOKEN=your_hugging_face_token_here
```

4. 启动开发服务器
```bash
npm run dev
```

5. 打开浏览器访问 `http://localhost:3000`

## 🎯 使用方法

1. **输入文字**: 在文本框中输入你想要生成的文本
2. **录制音色**: 点击"开始录音"按钮，录制一段清晰的人声样本（10-15秒）
3. **生成语音**: 点击"生成语音"按钮，等待 AI 处理
4. **播放下载**: 使用播放器播放生成的音频，或点击下载按钮保存

## 📂 项目结构

```
src/
├── app/                 # Next.js 应用路由
├── components/          # React 组件
│   ├── AudioPlayer.tsx  # 音频播放器
│   ├── RecordButton.tsx # 录音按钮
│   └── VoiceCloner.tsx  # 主界面组件
├── hooks/              # 自定义 Hook
│   └── useRecorder.ts  # 录音功能 Hook
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数
│   └── tts-api.ts      # TTS API 调用
```

## 🎬 使用场景

- **学生娱乐**: 模仿老师声音制作有趣音频
- **内容创作**: 为视频、播客快速生成配音
- **个人使用**: 克隆自己的声音制作个性化语音消息

## 🚫 使用限制

- 请确保有使用录音设备的权限
- 网络连接稳定以调用 TTS API
- 推荐使用现代浏览器（Chrome、Firefox、Safari、Edge）

## 📱 浏览器兼容性

- Chrome 66+
- Firefox 60+
- Safari 14+
- Edge 79+

## 🚀 部署到 Vercel

1. 将项目推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量 `HF_TOKEN`
4. 部署完成

## 📄 开源协议

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

© 2025 老师喊我去上学 - 音色克隆 TTS 应用
