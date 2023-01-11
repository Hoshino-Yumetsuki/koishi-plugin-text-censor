import { Context, Schema, Element } from 'koishi'
import { createHmac } from 'crypto'
import type { } from '@koishijs/assets'
import Censor from '@koishijs/censor'

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

// export const using = ['assets'] as const

export async function apply(ctx: Context, config: Config) {
  ctx.plugin(Censor)

  function normalize(params: Record<string, string>) {
    return Object.keys(params).sort().map(v => [encode(v), encode(params[v])]);
  }

  function canonicalize(normalized: string[][]) {
    return normalized.map((i) => `${i[0]}=${i[1]}`).join('&');
  }

  async function request(action: string, params) {
    const date = new Date().toISOString()

    params = {
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Math.random().toString(),
      SignatureVersion: '1.0',
      Timestamp: date,
      AccessKeyId: config.accessKeyId,
      Version: "2022-03-02",
      Action: action,
      ...params
    };
    let normalized = normalize(params);
    const canonicalized = canonicalize(normalized);
    const stringToSign = `POST&${encode('/')}&${encode(canonicalized)}`;
    const key = config.accessKeySecret + '&';
    const sha1 = createHmac('sha1', key)
    const signStr = sha1.update(stringToSign, 'utf8').digest('base64')
    normalized.push(['Signature', encode(signStr)]);

    return ctx.http.post(config.endpoint, canonicalize(normalized), {
      headers: {
        'x-acs-action': action,
        'x-acs-version': "2022-03-02"
      }
    })
  }

  ctx.censor.intercept({
    async text(attrs) {
      let r = await request('TextModeration', { "Service": "chat_detection", ServiceParameters: JSON.stringify({ content: attrs.content }) })
      if (!r.Data.labels) return attrs.content
      let riskWords = JSON.parse(r.Data.reason).riskWords.split(",")
      return attrs.content.replace(new RegExp(riskWords.join('|'), 'g'), (v) => '*'.repeat(v.length))
    },
    async image(attrs) {
      if (!ctx.assets && !attrs.url.startsWith("http")) {
        return Element('image', attrs)
      }
      let url = (!attrs.url.startsWith("http") && ctx.assets) ? await ctx.assets.upload(attrs.url, '') : attrs.url
      let r = await request('ImageModeration', { "Service": "baselineCheck", ServiceParameters: JSON.stringify({ imageUrl: url }) })
      if (r.Data.Result[0].Label.startsWith("nonLabel")) return Element('image', attrs)
      return ''
    }
  })
}
