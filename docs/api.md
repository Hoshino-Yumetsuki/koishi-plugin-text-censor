# API

## 消息组件

### `<censor>`

替换内部的敏感内容。具体的拦截规则由安装的插件决定。

## 公开方法

下面的公开方法可以直接通过 `ctx.censor` 使用。

### ctx.censor.transform(content)

- **content:** `Element[]` 要处理的消息内容
- 返回值: `Promise<Element[]>` 处理后的消息内容

对传入的内容进行处理，替换其中的敏感内容。

### ctx.censor.intercept(rules)

- **rules:** `Dict<Component>` 拦截规则
- 返回值: `() => boolean` 取消副作用

添加拦截规则，其效果类似 [`h.transformAsync()`](https://koishi.chat/api/message/api.html#h-transformasync)。
