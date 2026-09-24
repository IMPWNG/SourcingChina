import type { Category, Product } from "@/lib/records";

export function ProductList({ products, categories }: { products: Product[]; categories: Category[] }) {
  if (!products.length) return <p className="text-sm text-muted-foreground">No products saved yet.</p>;
  return (
    <ul className="space-y-4">
      {products.map((product) => {
        const category = categories.find((item) => item.id === product.category_id);
        const details = Object.entries(product.details);
        return (
          <li key={product.id} className="flex gap-3 text-sm">
            {product.image_url ? (
              // Supplier photos live on arbitrary hosts, so they are not run through the image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="h-20 w-20 shrink-0 rounded-md object-cover" />
            ) : null}
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{product.name}</p>
              {category ? <p className="text-xs text-muted-foreground">{category.name_en}</p> : null}
              {product.description ? <p className="text-muted-foreground">{product.description}</p> : null}
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
