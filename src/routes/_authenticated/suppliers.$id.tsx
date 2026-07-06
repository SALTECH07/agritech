import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Phone, MessageCircle, Package } from "lucide-react";
import { getSupplier } from "@/lib/suppliers.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/suppliers/$id")({
  component: SupplierDetail,
});

function SupplierDetail() {
  const { id } = Route.useParams();
  const { t, lang } = useT();
  const fn = useServerFn(getSupplier);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!data) return <p className="text-sm text-muted-foreground">{t("suppliers_empty")}</p>;

  const { supplier, products } = data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/suppliers">
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("suppliers_title")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{supplier.business_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {supplier.description && <p>{supplier.description}</p>}
          {(supplier.region || supplier.district || supplier.village) && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {[supplier.village, supplier.district, supplier.region].filter(Boolean).join(", ")}
            </p>
          )}
          <div className="flex gap-2 flex-wrap pt-2">
            {supplier.phone && (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${supplier.phone}`}>
                  <Phone className="h-4 w-4 mr-2" /> {supplier.phone}
                </a>
              </Button>
            )}
            {supplier.whatsapp && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://wa.me/${supplier.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Package className="h-5 w-5" /> {t("suppliers_products")}
        </h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("suppliers_no_products")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.category && <Badge variant="secondary">{p.category}</Badge>}
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {Number(p.price).toLocaleString()} {p.currency}
                    {p.unit && (
                      <span className="text-sm text-muted-foreground font-normal"> / {p.unit}</span>
                    )}
                  </p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  )}
                  {p.stock != null && (
                    <p className="text-xs text-muted-foreground">
                      {lang === "sw" ? "Akiba" : "Stock"}: {p.stock}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
