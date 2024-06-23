import { Context, Schema } from 'koishi'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Censor from '@koishijs/censor'
import Mint from 'mint-filter'

export const name = 'text-censor'

export interface Config {
  filename: string
}

export const Config: Schema<Config> = Schema.object({
  filename: Schema.string().description('存储敏感词的文件路径。').default('data/censor.txt'),
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
  const filter = new Mint(words, { transform: 'capital' })

  ctx.plugin(Censor)
  ctx.get('censor').intercept({
    async text(attrs) {
      const result = await filter.filter(attrs.content)
      if (typeof result.text !== 'string') return []
      return [result.text]
    },
  })
}
