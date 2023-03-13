import { Context, h, Logger, Schema } from 'koishi'
import Censor from '@koishijs/censor'

export const name = 'rr-image-censor'
export const usage = `
<style>
@keyframes rot {
  0% {
    transform: rotateZ(0deg);
  }
  100% {
    transform: rotateZ(360deg);
  }
}
.rotationStar {
  display: inline-block;
  animation: rot 0.5s linear infinite;
  opacity: 1;
  transition: 1.5s cubic-bezier(0.4, 0, 1, 1);
}
.rotationStar:hover {
  opacity: 0;
  transition: 0.35s cubic-bezier(0.4, 0, 1, 1);
}
{/* (谢谢你, Lonay)[https://github.com/Lipraty] */}
</style>

<span class="rotationStar">⭐</span>人人计划图像审核插件，使用教程请点击[插件主页](https://forum.koishi.xyz/t/topic/117)哦<span class="rotationStar">⭐</span>
`
const logger = new Logger(name)

export function apply(ctx: Context, config: Config) {
  ctx.plugin(Censor)
  const _dispose = ctx.censor.intercept({
    async image(attrs) {
      let reviewResult: ReviewResult
      const base64 = Buffer.from((await ctx.http.file(attrs.url)).data).toString('base64')
      const data: NsfwCheck = {
        image: base64
      }
      try {
        reviewResult = await ctx.http.post('https://rryth.elchapo.cn:11000/v1/check_safety',
          data, {
          headers: {
            'api': '42'
          }
        })
      }
      catch (error) {
        logger.error(error)
      }
      if (!reviewResult) return h('image', { url: attrs.url })
      let unsafe = false
      const scores = reviewResult.concept_scores
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] + config.offset > config.threshold[i]) {
          unsafe = true
          break
        }
      }

      if (!unsafe) return h('image', { url: attrs.url })
      if (config.debug) {
        let report = '';
        for (let i = 0; i < scores.length; i++) {
          if (i !== 0 && i % 3 === 0) {
            report += '\n';
          }
          report += scores[i] + ' ';
        }
        logger.info(`detected unsafe image with scores: ${report}`)
      }
      return 'detected_unsafe_images'
    }
  })
  ctx.on("dispose", () => {
    _dispose()
  })
}

export const Config: Schema<Config> = Schema.object({
  debug: Schema.boolean().description('调试模式，打印每张图的评分到日志。').default(false),
  offset: Schema.number().description('审核强度整体偏移量。').default(-0.016).max(1.0).min(-1.0),
  threshold: Schema.array(Schema.number()).description('每个分类的阈值微调。').default(Array(17).fill(0)),
})

export interface Config {
  debug?: boolean
  offset?: number
  threshold?: number[]
}
export interface NsfwCheck {
  image: string
}
export interface ReviewResult {
  concept_scores: number[]
}
