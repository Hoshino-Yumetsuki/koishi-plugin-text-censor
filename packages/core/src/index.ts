import { Component, Context, Dict, h, Service, Session } from 'koishi'

declare module 'koishi' {
  interface Context {
    censor: Censor
  }
}

class Censor extends Service {
  private interceptors = new Map<Dict<Component>, Context>()

  constructor(ctx: Context) {
    super(ctx, 'censor', true)
    ctx.component('censor', async (attrs, children, session) => {
      return this.transform(children, session)
    })
  }

  async transform(source: string, session: Session): Promise<string>
  async transform(source: h[], session: Session): Promise<h[]>
  async transform(source: string | h[], session: Session) {
    let elements = typeof source === "string" ? h.parse(source) : source
    for (const [interceptor, context] of this.interceptors) {
      if (session && !context.filter(session)) continue
      elements = await h.transformAsync(elements, interceptor)
    }
    return typeof source === "string" ? elements.join('') : elements
  }

  intercept(rules: Dict<Component>) {
    this.interceptors.set(rules, this.ctx)
    return this.ctx.collect('censor', () => this.interceptors.delete(rules))
  }
}

export default Censor
