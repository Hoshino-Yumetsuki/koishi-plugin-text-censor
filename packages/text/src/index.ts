import { Context, Logger, Schema } from 'koishi'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import Censor from '@koishijs/censor'
import Mint from 'mint-filter'

const logger = new Logger('text-censor')

export const name = 'text-censor'

export interface Config {
  filename: string
}

export const Config: Schema<Config> = Schema.object({
  filename: Schema.string().description('本地词库路径。').default('data/censor.txt'),
})

export function apply(ctx: Context, config: Config) {
  const filename = resolve(ctx.baseDir, config.filename)
  if (!existsSync(filename)) {
    logger.warn('dictionary file not found')
    return
  }

  const source = readFileSync(filename, 'utf8')
  const words = source
    .split('\n')
    .map(word => word.trim())
    .filter(word => word && !word.startsWith('//') && !word.startsWith('#'))
  const filter = new Mint(words, { transform: 'capital' })

  ctx.plugin(Censor)
  ctx.censor.intercept({
    async text(attrs) {
      const result = await filter.filter(attrs.content)
      if (typeof result.text !== 'string') return []
      return [result.text]
    },
  })
}
