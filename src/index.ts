import { Context, Schema } from 'koishi'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createMintFilter } from '@q78kg/mint-filter'
import Censor from '@koishijs/censor'

export const name = 'text-censor'

export interface Config {
    textDatabase: [string][]
    removeWords: boolean
    caseStrategy: 'capital' | 'none' | 'lower'
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
            .default(false),
        caseStrategy: Schema.union(['none', 'lower', 'capital'])
            .description('敏感词处理时的大小写策略')
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
        transform: config.caseStrategy,
        customCharacter: '*'
    } as const

    const filter = createMintFilter(words, mintOptions)

    ctx.plugin(Censor)
    ctx.get('censor').intercept({
        async text(attrs) {
            let processedText = attrs.content
            let matches: { start: number; end: number }[] = []

            // 收集所有正则表达式的匹配结果
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
                    ctx.logger.warn(`Invalid regex pattern: ${pattern}`)
                }
            }

            // 按位置排序并合并重叠区间
            matches.sort((a, b) => a.start - b.start)
            const mergedMatches: { start: number; end: number }[] = []
            for (const match of matches) {
                if (mergedMatches.length === 0 || mergedMatches[mergedMatches.length - 1].end < match.start) {
                    mergedMatches.push(match)
                } else {
                    mergedMatches[mergedMatches.length - 1].end = Math.max(
                        mergedMatches[mergedMatches.length - 1].end,
                        match.end
                    )
                }
            }

            // 从后向前处理文本，避免位置变化
            for (let i = mergedMatches.length - 1; i >= 0; i--) {
                const { start, end } = mergedMatches[i]
                const matchedText = processedText.slice(start, end)
                if (config.removeWords) {
                    // 删除匹配到的内容
                    processedText = processedText.slice(0, start) + processedText.slice(end)
                } else {
                    // 用星号替换
                    processedText = processedText.slice(0, start) + '*'.repeat(matchedText.length) + processedText.slice(end)
                }
            }

            // 修改敏感词库匹配逻辑
            const result = await filter.filter(processedText, {
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
    })
}
