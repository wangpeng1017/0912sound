# 部署配置说明

## 问题诊断

经过深入调试，发现 **tmpfiles.org 等临时文件服务无法被 Hugging Face Space 访问**，导致 F5-TTS 返回 404 错误。

## 解决方案

### 方案1：使用 Cloudinary（推荐）

1. 注册免费 Cloudinary 账户：https://cloudinary.com
2. 获取你的凭证（在 Dashboard 中）
3. 在 Vercel 环境变量中添加：
   ```
   CLOUDINARY_CLOUD_NAME=你的cloud_name
   CLOUDINARY_API_KEY=你的api_key
   CLOUDINARY_API_SECRET=你的api_secret
   ```

### 方案2：使用 GitHub Gist

1. 创建 GitHub Personal Access Token
   - 访问：https://github.com/settings/tokens
   - 生成新令牌，勾选 `gist` 权限
2. 在 Vercel 环境变量中添加：
   ```
   GITHUB_TOKEN=你的github_token
   ```

### 方案3：临时测试

如果不配置上述服务，系统会使用示例音频进行测试，但无法使用真实的语音克隆功能。

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