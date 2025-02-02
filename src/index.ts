import { Context, Schema } from 'koishi'
import { existsSync } from 'node:fs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
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
    const wordSet = new Set<string>()

    const loadDictionaries = async (): Promise<void> => {
        await Promise.all(
            config.textDatabase.map(async ([file]) => {
                const filePath = resolve(ctx.baseDir, file)

                try {
                    if (!existsSync(filePath)) {
                        ctx.logger.warn(
                            `dictionary file not found: ${filePath}, creating a new one.`
                        )
                        await mkdir(dirname(filePath), { recursive: true })
                        await writeFile(filePath, '')
                    }

                    const source = await readFile(filePath, 'utf8')
                    const fileWords = source
                        .split('\n')
                        .map((word) => word.trim())
                        .filter((word) => word && !/^[/#]/.test(word))

                    fileWords.forEach((word) => wordSet.add(word))
                } catch (error) {
                    ctx.logger.error(
                        `Error loading dictionary ${filePath}:`,
                        error
                    )
                }
            })
        )
    }

    const regexPatterns = config.regexPatterns
        .map((pattern) => {
            try {
                return new RegExp(pattern, 'gs')
            } catch (e) {
                ctx.logger.warn(
                    `Invalid regex pattern: ${pattern}, error: ${e.message}`
                )
                return null
            }
        })
        .filter((regex): regex is RegExp => regex !== null)

    const processedCache = new Map<string, string>()

    const processText = (text: string): string => {
        if (processedCache.has(text)) {
            return processedCache.get(text)!
        }

        let processedText = text
        const matches: Array<{ start: number; end: number }> = []

        for (const regex of regexPatterns) {
            for (const match of processedText.matchAll(regex)) {
                matches.push({
                    start: match.index!,
                    end: match.index! + match[0].length
                })
            }
        }

        if (matches.length > 0) {
            matches.sort((a, b) => a.start - b.start)
            const mergedMatches = matches.reduce<
                Array<{ start: number; end: number }>
            >((acc, curr) => {
                const last = acc[acc.length - 1]
                if (!last || last.end < curr.start) {
                    acc.push(curr)
                } else {
                    last.end = Math.max(last.end, curr.end)
                }
                return acc
            }, [])

            const parts: string[] = []
            let lastIndex = 0

            for (const { start, end } of mergedMatches) {
                parts.push(processedText.slice(lastIndex, start))
                parts.push(config.removeWords ? '' : '*'.repeat(end - start))
                lastIndex = end
            }
            parts.push(processedText.slice(lastIndex))

            processedText = parts.join('')
        }

        processedCache.set(text, processedText)
        return processedText
    }

    ctx.plugin(Censor)
    ctx.get('censor').intercept({
        async text(attrs) {
            let processedText = processText(attrs.content)

            if (wordSet.size > 0) {
                const filter = createMintFilter([...wordSet], {
                    customCharacter: '*'
                } as const)

                const result = filter.filter(processedText, {
                    replace: !config.removeWords
                })

                if (!result || typeof result.text !== 'string') return []

                if (config.removeWords) {
                    processedText = result.text
                        .split('')
                        .filter((char) => char !== '*')
                        .join('')
                }
                return [processedText.trim()]
            }

            return [processedText]
        }
    })

    loadDictionaries()
}
