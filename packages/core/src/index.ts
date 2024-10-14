import { Context, Schema } from 'koishi'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Censor from '@koishijs/censor'
import Mint from 'mint-filter'

export const name = 'text-censor'

export interface Config {
  filename: string
  removeWords: boolean // 是否直接删除敏感词
  transformToUpper: boolean // 新增配置项，决定是否将字符转换为大写
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
  const mintOptions = config.transformToUpper ? { transform: 'capital' } : {}

  // 创建敏感词过滤器
  const filter = new Mint(words, mintOptions)

  // 注册 Censor 插件
  ctx.plugin(Censor)
  ctx.get('censor').intercept({
    async text(attrs) {
      const result = await filter.filter(attrs.content)

      if (typeof result.text !== 'string') return []

      // 根据配置决定是删除敏感词还是进行其他处理
      if (config.removeWords) {
        // 如果设置为删除敏感词，将敏感词替换为空字符串
        const filteredText = words.reduce((text, word) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi') // 使用正则匹配敏感词
          return text.replace(regex, '') // 将敏感词替换为空字符串
        }, result.text)

        return [filteredText.trim()] // 返回删除敏感词后的文本
      } else {
        // 不删除敏感词，只返回处理后的文本
        return [result.text]
      }
    },
  })
}
