# koishi-plugin-aliyun-censor

使用阿里云内容安全的文本审核增强版和图片审核增强版 API 对文本和图片进行过滤。

使用 base64 或者本地图片时，需要 [assets 服务插件](https://assets.koishi.chat/)。

## 配置项

### accessKeyId

- 类型: `string`

参考 [阿里云文档](https://help.aliyun.com/document_detail/116401.html)

### accessKeySecret

- 类型: `string`

参考 [阿里云文档](https://help.aliyun.com/document_detail/116401.html)

### endpoint

- 类型: `string`
- 默认值： `https://green-cip.cn-shanghai.aliyuncs.com/`

参考 [阿里云文档](https://help.aliyun.com/document_detail/434034.html)

