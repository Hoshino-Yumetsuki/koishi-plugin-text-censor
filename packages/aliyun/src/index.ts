import { Context, Schema, Element, Dict } from 'koishi'
import { createHmac } from 'node:crypto'
import type { } from '@koishijs/assets'
import Censor from '@koishijs/censor'

export const name = 'aliyun-censor'

export interface Config {
  accessKeyId: string
  accessKeySecret: string
  endpoint: string
}

export const Config: Schema<Config> = Schema.object({
  accessKeyId: Schema.string().role('secret').required(),
  accessKeySecret: Schema.string().role('secret').required(),
  endpoint: Schema.string().role('link').default("https://green-cip.cn-shanghai.aliyuncs.com/").description('参考 [阿里云文档](https://help.aliyun.com/document_detail/434034.html)')
})

function encode(str: string) {
  var result = encodeURIComponent(str);

  return result.replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

export const inject = {
  required: ['http'],
  optional: ['assets']
}

export async function apply(ctx: Context, config: Config) {
  ctx.plugin(Censor)

  function normalize(params: Record<string, string>) {
    return Object.keys(params).sort().map(v => [encode(v), encode(params[v])]);
  }

  function canonicalize(normalized: string[][]) {
    return normalized.map((i) => `${i[0]}=${i[1]}`).join('&');
  }

  function request(action: string, params: Dict) {
    const date = new Date().toISOString()

    params = {
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Math.random().toString(),
      SignatureVersion: '1.0',
      Timestamp: date,
      AccessKeyId: config.accessKeyId,
      Version: '2022-03-02',
      Action: action,
      ...params
    }
    let normalized = normalize(params)
    const canonicalized = canonicalize(normalized)
    const stringToSign = `POST&${encode('/')}&${encode(canonicalized)}`
    const key = config.accessKeySecret + '&'
    const sha1 = createHmac('sha1', key)
    const signStr = sha1.update(stringToSign, 'utf8').digest('base64')
    normalized.push(['Signature', encode(signStr)])

    return ctx.http.post(config.endpoint, canonicalize(normalized), {
      headers: {
        'x-acs-action': action,
        'x-acs-version': '2022-03-02',
        'content-type': 'application/x-www-form-urlencoded'
      }
    })
  }

  ctx.get('censor').intercept({
    async text(attrs) {
      let r = await request('TextModeration', { Service: 'chat_detection', ServiceParameters: JSON.stringify({ content: attrs.content }) })
      if (!r.Data.labels) return attrs.content
      let riskWords = JSON.parse(r.Data.reason).riskWords.split(',')
      return attrs.content.replace(new RegExp(riskWords.join('|'), 'g'), (v) => '*'.repeat(v.length))
    },
    async img(attrs) {
      if (!ctx.assets && !attrs.src.startsWith('http')) {
        return Element('img', attrs)
      }
      let url = (!attrs.src.startsWith('http') && ctx.assets) ? await ctx.assets.upload(attrs.src, '') : attrs.src
      let r = await request('ImageModeration', { Service: 'baselineCheck', ServiceParameters: JSON.stringify({ imageUrl: url }) })
      if (r.Data.Result[0].Label.startsWith('nonLabel')) return Element('img', attrs)
      return ''
    }
  })
}
