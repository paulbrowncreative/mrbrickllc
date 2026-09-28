import sys, asyncio
from playwright.async_api import async_playwright
pages = sys.argv[1].split(',')
widths = [int(w) for w in sys.argv[2].split(',')]
full = len(sys.argv) > 3 and sys.argv[3] == 'full'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in widths:
            ctx = await b.new_context(viewport={'width': w, 'height': 900}, device_scale_factor=1)
            pg = await ctx.new_page()
            errs = []
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            for path in pages:
                await pg.goto('http://127.0.0.1:8080' + path, wait_until='networkidle')
                await pg.evaluate('''async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); }''')
                await pg.wait_for_timeout(400)
                ov = await pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
                name = (path.strip('/') or 'home').replace('/', '_')
                await pg.screenshot(path=f'/home/claude/shots/{name}-{w}.png', full_page=full)
                print(path, w, 'overflow', ov, 'errors', errs[:3]); errs.clear()
            await ctx.close()
        await b.close()
asyncio.run(main())
