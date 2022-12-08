# koishi-plugin-text-censor

此插件基于 Aho–Corasick 算法，对输入的文本内容进行过滤，并将所有的敏感词替换为 `*`。

参考：[mint-filter](https://github.com/ZhelinCheng/mint-filter)

## 配置项

### filename

- 类型: `string`
- 默认值: `data/censor.txt`

存储敏感词的文件路径。
