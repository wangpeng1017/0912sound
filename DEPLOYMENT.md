# 部署配置说明

## 问题诊断

经过深入调试，发现 **tmpfiles.org 等临时文件服务无法被 Hugging Face Space 访问**，导致 F5-TTS 返回 404 错误。

## 解决方案：使用 Vercel Blob Storage

本项目现在使用 **Vercel Blob Storage** 作为音频存储解决方案。这是 Vercel 官方提供的存储服务，与 Vercel 部署完美集成。

### 配置步骤

1. **启用 Blob Storage**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 进入您的项目
   - 点击 "Storage" 选项卡
   - 创建新的 Blob Store
   - 连接到您的项目

2. **设置环境变量**
   
   Vercel 会自动添加 `BLOB_READ_WRITE_TOKEN`，但您还需要添加：
   
   ```
   HF_TOKEN=您的_hugging_face_token
   NEXT_PUBLIC_HF_SPACE_URL=https://wangpe-2e2-f5-tts.hf.space
   ```

3. **本地开发**
   
   创建 `.env.local` 文件（不会上传到 GitHub）：
   ```
   BLOB_READ_WRITE_TOKEN="您的_blob_token"
   HF_TOKEN="您的_hf_token"
   NEXT_PUBLIC_HF_SPACE_URL="https://wangpe-2e2-f5-tts.hf.space"
   ```

### 优势

- **免费额度**：5GB 存储空间
- **完美集成**：与 Vercel 部署无缝集成
- **高性能**：全球 CDN 加速
- **简单配置**：无需第三方服务

## 其他环境变量

确保以下环境变量正确配置：
```
HF_SPACE_URL=https://wangpe-2e2-f5-tts.hf.space
HF_TOKEN=你的hugging_face_token
```

注意：HF_API_NAME 变量已不再使用，可以删除。

## 验证部署

1. 访问 `/api/tts-test` 端点验证基础功能
2. 在主页面测试完整的语音克隆流程

## 故障排除

如果仍有问题，查看 Vercel Functions 日志：
- "音频URL (provider):" 应该显示使用的存储服务
- 如果显示 "fallback"，说明没有配置存储服务
- 如果显示 "cloudinary" 或 "github-gist"，说明配置成功