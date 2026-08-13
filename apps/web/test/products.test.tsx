import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CliPage from '@/app/cli/page';
import KitPage from '@/app/kit/page';
import SdkPage from '@/app/sdk/page';
import sitemap from '@/app/sitemap';
import { ProductChooser } from '@/components/ProductChooser';
import { PRODUCTS } from '@/lib/products';

describe('product catalogue', () => {
  it('keeps available routes unique', () => {
    const routes = PRODUCTS.flatMap((product) => (product.href ? [product.href] : []));
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('keeps package identities explicit and consistent', () => {
    expect(PRODUCTS.find((product) => product.id === 'sdk')?.packageName).toBe('@savedyouatoken/sdk');
    expect(PRODUCTS.find((product) => product.id === 'cli')?.packageName).toBe('savedyouatoken');
    expect(PRODUCTS.find((product) => product.id === 'kit')?.packageName).toBe('savedyouatoken');
  });

  it('does not link to Monitor before an interest action exists', () => {
    const monitor = PRODUCTS.find((product) => product.id === 'monitor');
    expect(monitor).toMatchObject({ availability: 'planned', href: null, action: 'Planned' });
    expect(sitemap().some((entry) => entry.url.endsWith('/monitor'))).toBe(false);
  });
});

describe('product routes', () => {
  const routes = [
    ['sdk', SdkPage],
    ['cli', CliPage],
    ['kit', KitPage],
  ] as const;

  it.each(routes)('renders /%s as static product education with the shared chooser', (_, Page) => {
    const html = renderToStaticMarkup(<Page />);

    for (const product of PRODUCTS) {
      expect(html).toContain(product.name);
      expect(html).toContain(product.job);
    }
    expect(html).toContain('@savedyouatoken/sdk');
    expect(html).toContain('savedyouatoken');
    expect(html).toContain('Planned');
  });

  it('directs runtime requests to the SDK and file audits to the CLI', () => {
    const sdk = renderToStaticMarkup(<SdkPage />);
    const cli = renderToStaticMarkup(<CliPage />);

    expect(sdk).toContain('fully assembled');
    expect(sdk).toContain('Use this SDK when prompts are assembled dynamically');
    expect(cli).toContain('over files on your machine');
    expect(cli).toContain('href="/sdk"');
  });

  it('states that the agent kit invokes the CLI and is not the runtime SDK', () => {
    const html = renderToStaticMarkup(<KitPage />);

    expect(html).toContain('The kit is not the runtime SDK');
    expect(html).toContain('instructions invoke the live');
    expect(html).toContain('href="/sdk"');
  });

  it('uses the same chooser for every current product state', () => {
    const normalized = (current: 'sdk' | 'cli' | 'kit') =>
      renderToStaticMarkup(<ProductChooser current={current} />).replace('You are here', 'CURRENT');

    for (const current of ['sdk', 'cli', 'kit'] as const) {
      const html = normalized(current);
      expect((html.match(/Choose by what you need to do/g) ?? []).length).toBe(1);
      expect((html.match(/<article/g) ?? []).length).toBe(PRODUCTS.length);
    }
  });
});
