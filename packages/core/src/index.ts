import { Context, Schema } from 'koishi'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Mint from 'mint-filter'
import Censor from '@koishijs/censor'

export const name = 'text-censor'

export interface Config {
    textDatabase: [string][]
    removeWords: boolean // 是否直接删除敏感词
    transformToUpper: boolean // 是否将字符转换为大写
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        textDatabase: Schema.array(
            Schema.tuple([
                Schema.string().default('data/text-censor/censor.txt')
            ])
        )
            .description('敏感词库的文件路径。')
            .default([['data/text-censor/censor.txt']])
    }),
    Schema.object({
        removeWords: Schema.boolean()
            .description('是否直接删除敏感词。')
            .default(false),
        transformToUpper: Schema.boolean()
            .description('是否将字符转换为大写。')
            .default(false)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
]) as any

export function apply(ctx: Context, config: Config) {
    let words: string[] = []

    for (const [file] of config.textDatabase) {
        const filePath = resolve(ctx.baseDir, file)

        // 如果文件不存在，确保目录存在，然后创建文件
        if (!existsSync(filePath)) {
            ctx.logger.warn(
                `dictionary file not found: ${filePath}, creating a new one.`
            )

            const dirPath = dirname(filePath)
            if (!existsSync(dirPath)) {
                mkdirSync(dirPath, { recursive: true }) // 递归创建目录
            }

            writeFileSync(filePath, '') // 创建一个空文件
        }

        const source = readFileSync(filePath, 'utf8')
        const fileWords = source
            .split('\n')
            .map((word) => word.trim())
            .filter(
                (word) =>
                    word && !word.startsWith('//') && !word.startsWith('#')
            )

        words = words.concat(fileWords)
    }

    if (words.length === 0) {
        ctx.logger.warn('no sensitive words found')
        return
    }

    const mintOptions = {
        transform: config.transformToUpper ? 'capital' : 'none'
    } as const

    const filter = new Mint(words, mintOptions)

    ctx.plugin(Censor)
    ctx.get('censor').intercept({
        async text(attrs) {
            const originalText = attrs.content
            const result = await filter.filter(originalText)

            if (typeof result.text !== 'string') return []

            if (config.removeWords) {
                const cleanedText = result.text.replace(/\*/g, '')
                return [cleanedText.trim()]
            } else {
                return [result.text]
            }
        }
    })
}
