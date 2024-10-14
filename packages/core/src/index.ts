import { Context, Schema } from 'koishi'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Censor from '@koishijs/censor'
import Mint from 'mint-filter'

export const name = 'text-censor'

export interface Config {
  filename: string
  removeWords: boolean // 是否直接删除敏感词
  transformToUpper: boolean // 是否将字符转换为大写
}

export const Config: Schema<Config> = Schema.object({
  filename: Schema.string().description('存储敏感词的文件路径。').default('data/censor.txt'),
  removeWords: Schema.boolean().description('是否直接删除敏感词。').default(false), // 默认不删除敏感词
  transformToUpper: Schema.boolean().description('是否将字符转换为大写。').default(false), // 默认不转换字符为大写
})

export function apply(ctx: Context, config: Config) {
  const filename = resolve(ctx.baseDir, config.filename)
  if (!existsSync(filename)) {
    ctx.logger.warn('dictionary file not found')
    return
  }

  const source = readFileSync(filename, 'utf8')
  const words = source
    .split('\n')
    .map(word => word.trim())
    .filter(word => word && !word.startsWith('//') && !word.startsWith('#'))

  // 根据配置决定是否转换为大写
  const mintOptions = {
    transform: config.transformToUpper ? 'capital' : 'none', // 这里我们将值设置为可能的类型
  } as const;

  // 创建敏感词过滤器
  const filter = new Mint(words, mintOptions)

  // 注册 Censor 插件
  ctx.plugin(Censor)
  ctx.get('censor').intercept({
    async text(attrs) {
      const originalText = attrs.content; // 获取原始文本
      const result = await filter.filter(originalText); // 处理文本以过滤敏感词

      if (typeof result.text !== 'string') return []

      // 如果需要移除敏感词，进行上下文比较
      if (config.removeWords) {
        // 获取过滤后的文本
        const filteredText = result.text;

        // 找出原始文本中被过滤掉的字符
        const removedCharacters = Array.from(originalText).filter((char, index) => 
          filteredText[index] !== char // 如果对应位置的字符不相同，则为被过滤的字符
        ).join('');

        // 将被过滤的字符从原始文本中移除
        const cleanedText = originalText.split('').filter(char => 
          !removedCharacters.includes(char) // 过滤掉被移除的字符
        ).join('');

        return [cleanedText.trim()]; // 返回经过清理后的文本
      } else {
        // 不删除敏感词，只返回处理后的文本
        return [result.text];
      }
    },
  })
}
