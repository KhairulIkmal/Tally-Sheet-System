import type { Metadata } from "next";
import { requireOffice, storeFor } from "@/lib/auth/dal";
import { ProductManager } from "@/components/office/product-manager";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const user = await requireOffice();
  const products = await storeFor(user).listProducts(true);
  return <ProductManager products={products} />;
}
