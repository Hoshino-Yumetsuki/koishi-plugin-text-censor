import { Context, Schema } from 'koishi'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Mint from 'mint-filter'
import Censor from '@koishijs/censor'

export const name = 'text-censor'

export interface Config {
    textDatabase: [string, string][]
    removeWords: boolean // 是否直接删除敏感词
    transformToUpper: boolean // 是否将字符转换为大写
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        textDatabase: Schema.array(
            Schema.tuple([
                Schema.string().role('text'),
                Schema.string().default('data/text-censor/censor.txt')
            ])
        )
            .description('敏感词库的文件路径。')
            .default([['', 'data/text-censor/censor.txt']])
    }),
    Schema.object({
        removeWords: Schema.boolean()
            .description('是否直接删除敏感词。')
            .default(false), // 默认不删除敏感词
        transformToUpper: Schema.boolean()
            .description('是否将字符转换为大写。')
            .default(false) // 默认不转换字符为大写
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
]) as any

export function apply(ctx: Context, config: Config) {
    // 存储所有的敏感词
    let words: string[] = []

    // 遍历所有的文件名
    for (const [_, file] of config.textDatabase) {
        const filePath = resolve(ctx.baseDir, file)
        if (!existsSync(filePath)) {
            ctx.logger.warn(`dictionary file not found: ${filePath}`)
            continue
        }

        const source = readFileSync(filePath, 'utf8')
        const fileWords = source
            .split('\n')
            .map((word) => word.trim())
            .filter(
                (word) =>
                    word && !word.startsWith('//') && !word.startsWith('#')
            )

        // 合并当前文件的敏感词到总的词库中
        words = words.concat(fileWords)
    }

    if (words.length === 0) {
        ctx.logger.warn('no sensitive words found')
        return
    }

    // 根据配置决定是否转换为大写
    const mintOptions = {
        transform: config.transformToUpper ? 'capital' : 'none' // 这里我们将值设置为可能的类型
    } as const

    // 创建敏感词过滤器
    const filter = new Mint(words, mintOptions)

    // 注册 Censor 插件
    ctx.plugin(Censor)
    ctx.get('censor').intercept({
        async text(attrs) {
            const originalText = attrs.content // 获取原始文本
            const result = await filter.filter(originalText) // 处理文本以过滤敏感词

            if (typeof result.text !== 'string') return []

            // 如果需要移除敏感词，进行处理
            if (config.removeWords) {
                // 获取过滤后的文本，移除所有 '*' 号
                const cleanedText = result.text.replace(/\*/g, '') // 删除所有 '*' 号
                return [cleanedText.trim()] // 返回经过清理后的文本
            } else {
                // 不删除敏感词，只返回处理后的文本
                return [result.text]
            }
        }
    })
}
