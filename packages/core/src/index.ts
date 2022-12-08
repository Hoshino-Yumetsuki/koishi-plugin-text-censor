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

  async transform(children: h[]) {
    for (const interceptor of this.interceptors) {
      children = await h.transformAsync(children, interceptor)
    }
    return children
  }

  intercept(rules: Dict<Component>) {
    this.interceptors.add(rules)
    return this.caller.collect('censor', () => this.interceptors.delete(rules))
  }
}

export default Censor
