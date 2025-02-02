import { Context, Schema } from 'koishi'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createMintFilter } from '@q78kg/mint-filter'
import Censor from '@koishijs/censor'

export const name = 'text-censor'

export interface Config {
    textDatabase: [string][]
    removeWords: boolean
    regexPatterns: string[]
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        textDatabase: Schema.array(
            Schema.tuple([
                Schema.string().default('data/text-censor/censor.txt')
            ])
        )
            .description('敏感词库的文件路径')
            .default([['data/text-censor/censor.txt']]),
        regexPatterns: Schema.array(Schema.string())
            .description('正则表达式匹配模式列表')
            .default([])
    }),
    Schema.object({
        removeWords: Schema.boolean()
            .description('是否直接删除敏感词')
            .default(false)
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

    const filter =
        words.length > 0
            ? createMintFilter(words, {
                  customCharacter: '*'
              } as const)
            : null

    ctx.plugin(Censor)
    ctx.get('censor').intercept({
        async text(attrs) {
            let processedText = attrs.content
            const matches: { start: number; end: number }[] = []

            for (const pattern of config.regexPatterns) {
                try {
                    const regex = new RegExp(pattern, 'gs')
                    let match
                    while ((match = regex.exec(processedText)) !== null) {
                        matches.push({
                            start: match.index,
                            end: match.index + match[0].length
                        })
                    }
                } catch (e) {
                    ctx.logger.warn(
                        `Invalid regex pattern: ${pattern}, error: ${e.message}`
                    )
                }
            }

            matches.sort((a, b) => a.start - b.start)
            const mergedMatches: { start: number; end: number }[] = []
            for (const match of matches) {
                if (
                    mergedMatches.length === 0 ||
                    mergedMatches[mergedMatches.length - 1].end < match.start
                ) {
                    mergedMatches.push(match)
                } else {
                    mergedMatches[mergedMatches.length - 1].end = Math.max(
                        mergedMatches[mergedMatches.length - 1].end,
                        match.end
                    )
                }
            }

            for (let i = mergedMatches.length - 1; i >= 0; i--) {
                const { start, end } = mergedMatches[i]
                const matchedText = processedText.slice(start, end)
                if (config.removeWords) {
                    processedText =
                        processedText.slice(0, start) + processedText.slice(end)
                } else {
                    processedText =
                        processedText.slice(0, start) +
                        '*'.repeat(matchedText.length) +
                        processedText.slice(end)
                }
            }

            if (filter) {
                const result = filter.filter(processedText, {
                    replace: !config.removeWords
                })

                if (!result || typeof result.text !== 'string') return []

                if (config.removeWords) {
                    let cleanedText = processedText
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

            return [processedText]
        }
    })
}
