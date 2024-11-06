import { Context, Schema } from 'koishi'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Mint from 'mint-filter'
import Censor from '@koishijs/censor'

export const name = 'text-censor'

export interface Config {
    textDatabase: [string][]
    removeWords: boolean
    caseStrategy: 'capital' | 'none' | 'lower'
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
        caseStrategy: Schema.union(['none', 'lower', 'capital'])
            .description('敏感词处理时的大小写策略。')
            .default('none')
    })
]) as any

export function apply(ctx: Context, config: Config) {
    let words: string[] = []

    for (const [file] of config.textDatabase) {
        const filePath = resolve(ctx.baseDir, file)

        if (!existsSync(filePath)) {
            ctx.logger.warn(
                `dictionary file not found: ${filePath}, creating a new one.`
            )

            const dirPath = dirname(filePath)
            if (!existsSync(dirPath)) {
                mkdirSync(dirPath, { recursive: true })
            }

            writeFileSync(filePath, '')
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
        transform: config.caseStrategy
    } as const

    const filter = new Mint(words, mintOptions)

    ctx.plugin(Censor)
    ctx.get('censor').intercept({
        async text(attrs) {
            const originalText = attrs.content
            const result = await filter.filter(originalText)

            if (typeof result.text !== 'string') return []

            if (config.removeWords) {
                let cleanedText = originalText
                let lastIndex = 0

                for (let i = 0; i < result.text.length; i++) {
                    if (result.text[i] === '*') {
                        let asteriskCount = 0
                        while (
                            i + asteriskCount < result.text.length &&
                            result.text[i + asteriskCount] === '*'
                        ) {
                            asteriskCount++
                        }

                        const beforePart = cleanedText.slice(0, lastIndex)
                        const afterPart = cleanedText.slice(
                            lastIndex + asteriskCount
                        )
                        cleanedText = beforePart + afterPart

                        i += asteriskCount - 1
                    } else {
                        lastIndex++
                    }
                }

                return [cleanedText.trim()]
            } else {
                return [result.text]
            }
        }
    })
}
