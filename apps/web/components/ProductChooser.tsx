import Link from 'next/link';
import { PRODUCTS, type ProductId } from '@/lib/products';

export function ProductChooser({ current }: { current: ProductId }) {
  return (
    <section className="mt-14 border-t border-line pt-10" aria-labelledby="product-chooser-title">
      <div className="max-w-2xl">
        <h2 id="product-chooser-title" className="text-lg font-medium text-ink">
          Choose by what you need to do
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          These surfaces share the same audit engine, but they run at different points in your workflow.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((product) => {
          const isCurrent = product.id === current;
          return (
            <article
              key={product.id}
              className={`border-[1.5px] p-4 ${
                isCurrent ? 'border-line-strong bg-mint text-[#171713]' : 'border-line bg-panel'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className={`text-[14px] font-bold ${isCurrent ? 'text-[#171713]' : 'text-ink'}`}>
                  {product.name}
                </h3>
                {product.availability === 'planned' ? (
                  <span className="border border-line-strong px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted">
                    Planned
                  </span>
                ) : null}
              </div>
              <p className={`mt-2 text-[13px] font-medium ${isCurrent ? 'text-[#171713]' : 'text-ink'}`}>
                {product.job}
              </p>
              <p className={`mt-1.5 text-[12px] leading-relaxed ${isCurrent ? 'text-[#171713]/75' : 'text-muted'}`}>
                {product.description}
              </p>
              {product.packageName ? (
                <p className={`mt-3 font-mono text-[11px] ${isCurrent ? 'text-[#171713]/75' : 'text-faint'}`}>
                  npm: {product.packageName}
                </p>
              ) : null}
              <div className="mt-3 text-[12px] font-bold">
                {product.href && !isCurrent ? (
                  <Link href={product.href} className="text-info underline underline-offset-2">
                    {product.action}
                  </Link>
                ) : (
                  <span className={isCurrent ? 'text-[#171713]' : 'text-faint'}>
                    {isCurrent ? 'You are here' : product.action}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
