import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TabSwitcher from "@/components/ui/TabSwitcher"
import { getMemberProducts, getProducts, getProductPromotions, getProductSales } from "@/app/actions/products"
import { canCollectPayment } from "@/lib/payments"
import ProductCatalogPanel from "@/components/products/ProductCatalogPanel"
import SellProductPanel from "@/components/products/SellProductPanel"
import ProductSalesPanel from "@/components/products/ProductSalesPanel"
import ProductPromotionPanel from "@/components/products/ProductPromotionPanel"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Productos" }

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("gym_id, role, can_collect_payments")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { gym_id: string | null; role: string; can_collect_payments: boolean } | null
  if (!profile) redirect("/dashboard")

  const isAdmin = profile.role === "admin"
  const isMember = profile.role === "member"
  const canSell = canCollectPayment(profile.role, profile.can_collect_payments === true)

  const tabs = [
    { key: "catalogo", label: "Catálogo" },
    ...(!isMember && canSell ? [{ key: "vender", label: "Vender" }] : []),
    ...(isAdmin ? [{ key: "ventas", label: "Ventas" }, { key: "promociones", label: "Promociones" }] : []),
  ]
  const requestedTab = searchParams.tab ?? "catalogo"
  const tab = tabs.some(t => t.key === requestedTab) ? requestedTab : "catalogo"

  let content: React.ReactNode

  if (tab === "vender" && !isMember && canSell) {
    const productsResult = await getProducts()
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("gym_id", profile.gym_id ?? "")
      .eq("role", "member")
      .order("full_name") as unknown as { data: { id: string; full_name: string | null }[] | null }

    content = productsResult.products
      ? <SellProductPanel products={productsResult.products} members={members ?? []} />
      : <p className="text-sm text-red-500">{productsResult.error}</p>
  } else if (tab === "ventas" && isAdmin) {
    const salesResult = await getProductSales()
    content = salesResult.sales
      ? <ProductSalesPanel sales={salesResult.sales} />
      : <p className="text-sm text-red-500">{salesResult.error}</p>
  } else if (tab === "promociones" && isAdmin) {
    const [productsResult, promotionsResult] = await Promise.all([getProducts(true), getProductPromotions()])
    content = productsResult.products && promotionsResult.promotions
      ? <ProductPromotionPanel products={productsResult.products} promotions={promotionsResult.promotions} />
      : <p className="text-sm text-red-500">{productsResult.error ?? promotionsResult.error}</p>
  } else {
    const productsResult = isMember ? await getMemberProducts() : await getProducts(isAdmin)
    content = productsResult.products
      ? <ProductCatalogPanel products={productsResult.products} isAdmin={isAdmin} />
      : <p className="text-sm text-red-500">{productsResult.error}</p>
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Productos</h1>
        <p className="text-muted-foreground">Catálogo, stock y ventas del mostrador</p>
      </div>
      <TabSwitcher tabs={tabs} activeTab={tab} />
      {content}
    </div>
  )
}


