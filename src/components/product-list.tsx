import { categoryLabel, HIDDEN_DETAIL_KEYS, translated, type Locale } from "@/lib/i18n";
import type { Category, Product } from "@/lib/records";

export function ProductList({
  products,
  categories,
  locale = "en",
  empty = "No products saved yet.",
}: {
  products: Product[];
  categories: Category[];
  locale?: Locale;
  empty?: string;
}) {
  if (!products.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-4">
      {products.map((product) => {
        const category = categories.find((item) => item.id === product.category_id);
        const name = translated(product.details, "name", locale, product.name) ?? product.name;
        const description = translated(product.details, "description", locale, product.description);
        const details = Object.entries(product.details).filter(([key]) => !HIDDEN_DETAIL_KEYS.has(key));
        return (
          <li key={product.id} className="flex gap-3 text-sm">
            {product.image_url && !/logo|icon|wechat|weixin|facebook|youtube|douyin|qrcode/i.test(product.image_url) ? (
              // Supplier photos live on arbitrary hosts, so they are not run through the image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={name} width={80} height={80} loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-md object-cover" />
            ) : (
              <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                <rect x="22" y="28" width="36" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M22 36h36M32 28v-4h16v4" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{name}</p>
              {category ? <p className="text-xs text-muted-foreground">{categoryLabel(category.slug, locale, category.name_en)}</p> : null}
              {description ? <p className="text-muted-foreground">{description}</p> : null}
              {details.length ? (
                <p className="text-muted-foreground">{details.map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
