import { Component, Context, Dict, h, Service } from 'koishi'

declare module 'koishi' {
  interface Context {
    censor: Censor
  }
}

class Censor extends Service {
  private interceptors = new Set<Dict<Component>>()

  constructor(ctx: Context) {
    super(ctx, 'censor', true)
    ctx.component('censor', async (attrs, children, session) => {
      return this.transform(children)
    })
  }

  async transform(source: string): Promise<string>
  async transform(source: h[]): Promise<h[]>
  async transform(source: string | h[]) {
    let elements = typeof source === "string" ? h.parse(source) : source
    for (const interceptor of this.interceptors) {
      elements = await h.transformAsync(elements, interceptor)
    }
    return typeof source === "string" ? elements.join('') : elements
  }

  intercept(rules: Dict<Component>) {
    this.interceptors.add(rules)
    return this.caller.collect('censor', () => this.interceptors.delete(rules))
  }
}

export default Censor
